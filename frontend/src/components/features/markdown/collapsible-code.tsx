import React from "react";

/**
 * A long code block in the chat is a wall: on a phone a 300-line file pushes the
 * conversation off the screen entirely, and you scroll past it rather than read it.
 * Blocks longer than PREVIEW_LINES open showing their first few lines and a button
 * saying how much is hidden. Short ones are untouched -- collapsing a three-line
 * command would only add a click.
 */
const PREVIEW_LINES = 6;

/** Collapse only when hiding is worth a click: a couple of lines over is not. */
export function shouldCollapse(code: string, threshold = PREVIEW_LINES): boolean {
  return code.split("\n").length > threshold + 2;
}

export function previewOf(code: string, lines = PREVIEW_LINES): string {
  return code.split("\n").slice(0, lines).join("\n");
}

interface Props {
  code: string;
  /** Renders whatever slice of the code it is given, highlighted or not. */
  children: (shown: string) => React.ReactNode;
  label?: string;
}

export function CollapsibleCode({ code, children, label }: Props) {
  const [expanded, setExpanded] = React.useState(false);
  const total = code.split("\n").length;

  if (!shouldCollapse(code)) return <>{children(code)}</>;

  const hidden = total - PREVIEW_LINES;
  return (
    <div data-testid="collapsible-code">
      <div className={expanded ? undefined : "relative"}>
        {children(expanded ? code : previewOf(code))}
        {!expanded && (
          // Fades the last preview line so it reads as cut off rather than finished.
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#2a3038] to-transparent rounded-b-lg"
          />
        )}
      </div>
      <button
        type="button"
        data-testid="collapsible-code-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
        className="mt-1 text-xs leading-4 text-[#A3A3A3] hover:text-white cursor-pointer min-h-9"
      >
        {expanded
          ? `Show less${label ? ` · ${label}` : ""}`
          : `Show ${hidden} more line${hidden === 1 ? "" : "s"}${label ? ` · ${label}` : ""}`}
      </button>
    </div>
  );
}
