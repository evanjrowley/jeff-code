import type { ToolCall } from "@jeffhub/jeff-code-ai";
import { describe, expect, it } from "vitest";
import type { Lists } from "../src/core/jeff-first/lists.ts";
import { ruleStep, taskPaths } from "../src/core/jeff-first/rules.ts";
import type { Step } from "../src/core/jeff-first/transcript.ts";

const call = (name: string, args: Record<string, unknown>): ToolCall =>
	({ type: "toolCall", id: "x", name, arguments: args }) as unknown as ToolCall;

const step = (call: ToolCall, byScout = false): Step => ({ call, output: "", isError: false, byScout });

function lists(options: { read?: string[]; check?: string[] }): Lists {
	const read = (options.read ?? []).map((path, index) => ({
		id: `read-${index + 1}`,
		description: `Read the file ${path}`,
		toolCall: { name: "bash", arguments: { command: `cat '${path}'`, timeout: 60 } },
	}));
	const check = (options.check ?? []).map((command, index) => ({
		id: `check-${index + 1}`,
		description: command,
		toolCall: { name: "bash", arguments: { command, timeout: 120 } },
	}));
	return {
		tools: [
			...(read.length ? [{ id: "read" as const, description: "Read" }] : []),
			...(check.length ? [{ id: "check" as const, description: "Check" }] : []),
			{ id: "hand_over", description: "Hand over" },
		],
		argumentsByTool: {
			...(read.length ? { read } : {}),
			...(check.length ? { check } : {}),
		},
	};
}

describe("taskPaths", () => {
	it("finds the files a task names, with or without a folder", () => {
		expect(taskPaths("Run node test.js in the current directory. It fails. Fix the bug in sum.js and lib/strings.ts")).toEqual([
			"test.js",
			"sum.js",
			"lib/strings.ts",
		]);
	});

	it("ignores words that are not file names", () => {
		expect(taskPaths("Make the tests pass. Then stop.")).toEqual([]);
	});
});

describe("ruleStep", () => {
	const noCheck = { checks: [] as string[] };

	it("reads a file the task names when no step has read it", () => {
		const listsWith = lists({ read: ["test.js", "sum.js"] });
		const got = ruleStep({ task: "Fix the bug in sum.js", steps: [], lists: listsWith, ...noCheck });
		expect(got).toEqual({
			rule: "read_named_file",
			toolCall: { name: "bash", arguments: { command: "cat 'sum.js'", timeout: 60 } },
		});
	});

	it("does not read a named file twice", () => {
		const listsWith = lists({ read: ["sum.js", "test.js"] });
		const steps = [step(call("bash", { command: "cat 'sum.js'" }), true)];
		const got = ruleStep({ task: "Fix the bug in sum.js, then check test.js", steps, lists: listsWith, ...noCheck });
		expect(got).toEqual({
			rule: "read_named_file",
			toolCall: { name: "bash", arguments: { command: "cat 'test.js'", timeout: 60 } },
		});
	});

	it("does not read a named file the coding model already read", () => {
		const listsWith = lists({ read: ["sum.js"] });
		const steps = [step(call("bash", { command: "cat 'sum.js'" }), false)];
		expect(ruleStep({ task: "Fix sum.js", steps, lists: listsWith, ...noCheck })).toBeNull();
	});

	it("returns nothing when the task names no file, leaving the question to the chooser", () => {
		expect(
			ruleStep({ task: "Make the tests pass", steps: [], lists: lists({ read: ["sum.js"] }), ...noCheck }),
		).toBeNull();
	});

	it("runs the project's check after the coding model wrote a file", () => {
		const listsWith = lists({ check: ["node test.js"] });
		const steps = [step(call("edit", { path: "sum.js" }), false)];
		expect(ruleStep({ task: "Make the tests pass", steps, lists: listsWith, checks: ["node test.js"] })).toEqual({
			rule: "run_check_after_write",
			toolCall: { name: "bash", arguments: { command: "node test.js", timeout: 120 } },
		});
	});

	it("does not run a check that already ran since the write", () => {
		const listsWith = lists({ check: ["node test.js"] });
		const steps = [
			step(call("edit", { path: "sum.js" }), false),
			step(call("bash", { command: "node test.js" }), true),
		];
		expect(ruleStep({ task: "Make the tests pass", steps, lists: listsWith, checks: ["node test.js"] })).toBeNull();
	});

	it("runs the check again after a later write", () => {
		const listsWith = lists({ check: ["node test.js"] });
		const steps = [
			step(call("edit", { path: "sum.js" }), false),
			step(call("bash", { command: "node test.js" }), true),
			step(call("edit", { path: "sum.js" }), false),
		];
		expect(ruleStep({ task: "Make the tests pass", steps, lists: listsWith, checks: ["node test.js"] })?.rule).toBe(
			"run_check_after_write",
		);
	});

	it("does not run a check before any write", () => {
		const listsWith = lists({ check: ["node test.js"] });
		const steps = [step(call("bash", { command: "ls" }), false)];
		expect(ruleStep({ task: "Make the tests pass", steps, lists: listsWith, checks: ["node test.js"] })).toBeNull();
	});

	it("prefers the named-file read over the check", () => {
		const listsWith = lists({ read: ["sum.js"], check: ["node test.js"] });
		const steps = [step(call("edit", { path: "sum.js" }), false)];
		expect(ruleStep({ task: "Fix sum.js", steps, lists: listsWith, checks: ["node test.js"] })?.rule).toBe(
			"read_named_file",
		);
	});
});
