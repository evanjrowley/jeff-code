import { describe, expect, it } from "vitest";
import type { Lists, ToolKind } from "../src/core/jeff-first/lists.ts";
import { narrowLists } from "../src/core/jeff-first/narrow.ts";

const option = (kind: ToolKind, index: number) => ({
	id: `${kind}-${index}`,
	description: `${kind} option`,
	toolCall: { name: "bash", arguments: { command: `${kind} ${index}` } },
});

function lists(kinds: ToolKind[]): Lists {
	const argumentsByTool: Lists["argumentsByTool"] = {};
	for (const kind of kinds) argumentsByTool[kind] = [option(kind, 1)];
	return {
		tools: [...kinds.map((id) => ({ id, description: id })), { id: "hand_over", description: "Hand over" }],
		argumentsByTool,
	};
}

describe("narrowLists", () => {
	it("keeps the kinds with the most concrete evidence, and hand-over", () => {
		const got = narrowLists(lists(["search", "docs", "read", "check", "list"]), 3);
		// Evidence order ranks read, check, list above search and docs; the page keeps its original order.
		expect(got.tools.map((tool) => tool.id)).toEqual(["read", "check", "list", "hand_over"]);
		expect(Object.keys(got.argumentsByTool).sort()).toEqual(["check", "list", "read"]);
	});

	it("leaves a page that is already small enough alone", () => {
		const before = lists(["read", "check"]);
		expect(narrowLists(before, 3)).toEqual(before);
	});

	it("keeps every kind when the limit is zero or negative", () => {
		const before = lists(["read", "check", "list", "search"]);
		expect(narrowLists(before, 0)).toEqual(before);
	});

	it("always leaves hand-over as an option", () => {
		const got = narrowLists(lists(["read", "check", "list"]), 1);
		expect(got.tools.map((tool) => tool.id)).toEqual(["read", "hand_over"]);
	});
});
