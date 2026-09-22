import type { ActionEvent } from "#/types/v1/core";

const lines = (text: string | null | undefined) =>
  text ? text.split("\n").length : 0;

/**
 * One line that says what a file edit does, so a phone user can decide from the
 * panel: "new file, 111 lines", "replace 3 lines with 5", "insert 4 lines at 12".
 */
export function fileEditorSummary(action: {
  kind?: string;
  command?: string;
  file_text?: string | null;
  old_str?: string | null;
  new_str?: string | null;
  insert_line?: number | null;
}): string | null {
  if (
    action.kind !== "FileEditorAction" &&
    action.kind !== "StrReplaceEditorAction" &&
    action.kind !== "PlanningFileEditorAction"
  )
    return null;
  switch (action.command) {
    case "create":
      return `new file, ${lines(action.file_text)} lines`;
    case "str_replace":
      return `replace ${lines(action.old_str)} lines with ${lines(action.new_str)}`;
    case "insert":
      return `insert ${lines(action.new_str)} lines at ${action.insert_line ?? "?"}`;
    case "undo_edit":
      return "undo the last edit";
    default:
      return null;
  }
}

function djb2(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) {
    // eslint-disable-next-line no-bitwise
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

/** Same tool, same arguments => same fingerprint; used to not ask twice. The whole
 * action counts (a click on another square is another action), file contents hashed. */
export function fingerprintAction(event: ActionEvent): string {
  const a = { ...(event.action as Record<string, unknown>) };
  ["file_text", "old_str", "new_str"].forEach((k) => {
    if (typeof a[k] === "string") a[k] = djb2(a[k] as string);
  });
  const body = JSON.stringify(
    { tool: event.tool_name, action: a },
    Object.keys({ tool: 0, action: 0, ...a }).sort(),
  );
  return djb2(body);
}
