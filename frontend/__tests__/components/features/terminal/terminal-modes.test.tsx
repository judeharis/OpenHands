import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("#/components/features/terminal/shell-terminal", () => ({
  ShellTerminal: () => <div data-testid="shell-terminal" />,
}));
vi.mock("#/hooks/use-terminal", () => ({
  useTerminal: () => React.createRef(),
}));
vi.mock("#/hooks/use-agent-state", () => ({
  useAgentState: () => ({ curAgentState: "running", isArchived: false }),
}));
vi.mock("react-i18next", async () => ({
  ...(await vi.importActual<object>("react-i18next")),
  useTranslation: () => ({ t: (key: string) => key }),
}));

import Terminal from "#/components/features/terminal/terminal";

describe("Terminal tab", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("opens on a shell you can type into", () => {
    render(<Terminal />);
    expect(screen.getByTestId("shell-terminal")).toBeInTheDocument();
    expect(screen.getByTestId("terminal-mode-shell")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("switches to the agent's log and remembers the choice", () => {
    const { unmount } = render(<Terminal />);
    fireEvent.click(screen.getByTestId("terminal-mode-agent"));
    expect(screen.getByTestId("agent-terminal-log")).toBeInTheDocument();
    expect(screen.queryByTestId("shell-terminal")).not.toBeInTheDocument();
    unmount();
    render(<Terminal />);
    expect(screen.getByTestId("terminal-mode-agent")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
