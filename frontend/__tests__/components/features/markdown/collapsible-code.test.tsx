import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CollapsibleCode,
  previewOf,
  shouldCollapse,
} from "#/components/features/markdown/collapsible-code";

const lines = (n: number) =>
  Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n");

describe("long code blocks in the chat (jentic)", () => {
  it("leaves a short block alone rather than adding a click", () => {
    expect(shouldCollapse(lines(5))).toBe(false);
    render(
      <CollapsibleCode code={lines(5)}>{(shown) => <pre>{shown}</pre>}</CollapsibleCode>,
    );
    expect(screen.queryByTestId("collapsible-code-toggle")).toBeNull();
    expect(screen.getByText(/line 5/)).toBeInTheDocument();
  });

  it("shows the first lines of a long one and hides the rest", () => {
    render(
      <CollapsibleCode code={lines(120)}>{(shown) => <pre>{shown}</pre>}</CollapsibleCode>,
    );
    expect(screen.getByText(/line 6/)).toBeInTheDocument();
    expect(screen.queryByText(/line 7\b/)).toBeNull();
    expect(screen.getByTestId("collapsible-code-toggle")).toHaveTextContent(
      "Show 114 more lines",
    );
  });

  it("expands and collapses again on click", async () => {
    render(
      <CollapsibleCode code={lines(120)}>{(shown) => <pre>{shown}</pre>}</CollapsibleCode>,
    );
    const toggle = screen.getByTestId("collapsible-code-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(toggle);
    expect(screen.getByText(/line 120/)).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(toggle);
    expect(screen.queryByText(/line 120/)).toBeNull();
  });

  it("names the language when it knows it", () => {
    render(
      <CollapsibleCode code={lines(40)} label="python">
        {(shown) => <pre>{shown}</pre>}
      </CollapsibleCode>,
    );
    expect(screen.getByTestId("collapsible-code-toggle")).toHaveTextContent("python");
  });

  it("previews whole lines, not a cut-off one", () => {
    expect(previewOf(lines(50))).toBe(lines(6));
  });
});
