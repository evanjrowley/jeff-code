import type { Lists, ToolKind } from "./lists.ts";

/**
 * The question the chooser is asked today offers every tool kind whose preconditions hold, up to twelve,
 * with hand-over as one more option. The trained step adapter ranks hand-over first in 234 of 238
 * measured decisions, so a page that small still leaves hand-over with the largest share.
 *
 * `narrowLists` shrinks the page to the few kinds the state most supports. The order below is evidence
 * strength, not tool preference: a kind whose options were built from a file the task names or the model
 * just wrote outranks one built from a general probe. Hand-over stays on the page, so the chooser still
 * has the option it prefers; the question simply asks it about less.
 */

/** Tool kinds in order of how concrete the state evidence behind their options is. */
const EVIDENCE_ORDER: ToolKind[] = [
	"read",
	"check",
	"run",
	"peek",
	"list",
	"search",
	"find",
	"repeat",
	"toolchain",
	"service",
	"docs",
	"install",
];

export function narrowLists(lists: Lists, most: number): Lists {
	if (most <= 0) return lists;
	const offered = lists.tools
		.map((tool) => tool.id)
		.filter((id): id is ToolKind => id !== "hand_over" && id in lists.argumentsByTool);
	if (offered.length <= most) return lists;
	const ranked = [...offered].sort((a, b) => EVIDENCE_ORDER.indexOf(a) - EVIDENCE_ORDER.indexOf(b)).slice(0, most);
	const tools = lists.tools.filter((tool) => tool.id === "hand_over" || ranked.includes(tool.id as ToolKind));
	const argumentsByTool: Lists["argumentsByTool"] = {};
	for (const kind of ranked) {
		const options = lists.argumentsByTool[kind];
		if (options) argumentsByTool[kind] = options;
	}
	return { tools, argumentsByTool };
}
