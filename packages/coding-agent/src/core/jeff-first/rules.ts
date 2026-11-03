import { basename } from "node:path";
import type { Lists } from "./lists.ts";
import type { MenuToolCall } from "./menu.ts";
import type { Step } from "./transcript.ts";

/**
 * Steps the harness takes without asking the decision model, for the cases where the state itself says
 * what to do next. The trained chooser ranks hand-over first in almost every decision (234 of 238 in the
 * 2026-11-01 traces), so a question it answers well is one it is never asked. These rules are the
 * questions with one safe answer, checked here instead:
 *
 * - "read_named_file": the task names a file that no step has read yet. Qwen reads it on its next turn
 *   anyway; taking it here costs the same bytes and saves the turn.
 * - "run_check_after_write": the coding model just wrote a file and the project has a check command that
 *   has not run since that write. Qwen runs the same command next.
 *
 * Both pick their call from the list the chooser would have been shown, so the arguments match the
 * scout's own option shapes. A rule that finds no such option takes nothing: the question goes to the
 * chooser as before.
 */
export interface RuleStep {
	rule: "read_named_file" | "run_check_after_write";
	toolCall: MenuToolCall;
}

/** File paths and names with a known extension, as the task text writes them. */
const TASK_PATH = /(?:^|[\s("'`])((?:\.{0,2}\/)?[\w./-]+\.[A-Za-z][A-Za-z0-9]{0,9})(?=$|[\s)"'`,.;:])/g;

export function taskPaths(task: string): string[] {
	const found: string[] = [];
	for (const match of task.matchAll(TASK_PATH)) {
		const path = match[1];
		if (!found.includes(path)) found.push(path);
	}
	return found;
}

/** The bash command an option would run, or null for a call that is not a shell command. */
function commandOf(call: MenuToolCall): string | null {
	if (call.name !== "bash") return null;
	const command = call.arguments.command;
	return typeof command === "string" ? command : null;
}

function mentions(command: string, path: string): boolean {
	return command.includes(path) || command.includes(basename(path));
}

function readByName(input: RuleInput): RuleStep | null {
	const options = input.lists.argumentsByTool.read ?? [];
	if (options.length === 0) return null;
	const readCommands = input.steps.map((step) => commandOf(step.call)).filter((c): c is string => c !== null);
	for (const path of taskPaths(input.task)) {
		// Only a file the session has not looked at yet: after a read, the next move is Qwen's.
		if (readCommands.some((command) => mentions(command, path))) continue;
		const option = options.find((candidate) => {
			const command = commandOf(candidate.toolCall);
			return command !== null && mentions(command, path);
		});
		if (option) return { rule: "read_named_file", toolCall: option.toolCall };
	}
	return null;
}

const WRITE_TOOLS = new Set(["write", "edit"]);

function checkAfterWrite(input: RuleInput): RuleStep | null {
	const options = input.lists.argumentsByTool.check ?? [];
	if (options.length === 0 || input.checks.length === 0) return null;
	const lastWrite = input.steps.findLastIndex((step) => WRITE_TOOLS.has(step.call.name));
	if (lastWrite < 0) return null;
	const after = input.steps.slice(lastWrite + 1);
	const ranSince = after
		.map((step) => commandOf(step.call))
		.filter((command): command is string => command !== null);
	const pending = input.checks.find((check) => !ranSince.some((command) => command.includes(check)));
	if (pending === undefined) return null;
	const option = options.find((candidate) => {
		const command = commandOf(candidate.toolCall);
		return command !== null && command.includes(pending);
	});
	return option ? { rule: "run_check_after_write", toolCall: option.toolCall } : null;
}

export interface RuleInput {
	task: string;
	steps: Step[];
	checks: string[];
	lists: Lists;
}

/** The rule step to take now, or null when the question belongs to the chooser. */
export function ruleStep(input: RuleInput): RuleStep | null {
	return readByName(input) ?? checkAfterWrite(input);
}
