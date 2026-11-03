import type { Lists, ToolKind } from "./lists.ts";

/**
 * The forced choice always names a tool, so when the only options left are probes it takes one: the
 * measurement showed listings and searches standing in for reads once the reads were gone (927 ls against
 * 196, and the calls doubled). The gate refuses that trade: force a choice only while a kind whose options
 * come from the task's own facts is on the page, and hand over once only probes are left.
 *
 * High evidence is a kind whose options name something concrete from the run: a file the task names or the
 * coding model wrote (read), the project's check command (check), a script the coding model wrote (run).
 * Peeking at data, listing, searching, finding and repeating a command are useful but generic: alone they
 * do not justify acting over handing over.
 */
const HIGH_EVIDENCE: ToolKind[] = ["read", "check", "run"];

export function hasEvidence(lists: Lists): boolean {
	return HIGH_EVIDENCE.some((kind) => (lists.argumentsByTool[kind]?.length ?? 0) > 0);
}

/** The kinds with high evidence, in the order the page already lists them. */
export function evidenceTools(lists: Lists): ToolKind[] {
	return lists.tools
		.map((tool) => tool.id)
		.filter((id): id is ToolKind => HIGH_EVIDENCE.includes(id as ToolKind) && (lists.argumentsByTool[id as ToolKind]?.length ?? 0) > 0);
}
