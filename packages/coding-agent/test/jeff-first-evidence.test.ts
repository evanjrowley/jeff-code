import { describe, expect, it } from "vitest";
import { hasEvidence, evidenceTools } from "../src/core/jeff-first/evidence.ts";
import type { Lists, ToolKind } from "../src/core/jeff-first/lists.ts";

const option = (kind: ToolKind) => ({
	id: `${kind}-1`,
	description: kind,
	toolCall: { name: "bash", arguments: { command: `${kind} 1` } },
});

function lists(kinds: ToolKind[]): Lists {
	const argumentsByTool: Lists["argumentsByTool"] = {};
	for (const kind of kinds) argumentsByTool[kind] = [option(kind)];
	return { tools: [...kinds.map((id) => ({ id, description: id })), { id: "hand_over", description: "Hand over" }], argumentsByTool };
}

describe("hasEvidence", () => {
	it("is true for a file to read, a check to run or a script to run", () => {
		expect(hasEvidence(lists(["read"]))).toBe(true);
		expect(hasEvidence(lists(["check"]))).toBe(true);
		expect(hasEvidence(lists(["run"]))).toBe(true);
	});

	it("is false when only probes are left", () => {
		expect(hasEvidence(lists(["list", "search", "find", "toolchain", "docs", "install"]))).toBe(false);
		expect(hasEvidence(lists([]))).toBe(false);
	});

	it("counts a kind whose options were all filtered out as absent", () => {
		const empty = lists(["read"]);
		empty.argumentsByTool.read = [];
		expect(hasEvidence(empty)).toBe(false);
	});
});

describe("evidenceTools", () => {
	it("names the high-evidence kinds on the page, in page order", () => {
		expect(evidenceTools(lists(["list", "read", "check", "search"]))).toEqual(["read", "check"]);
	});
});
