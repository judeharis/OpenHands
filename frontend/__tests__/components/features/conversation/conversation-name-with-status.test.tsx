import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ phone: true, pause: vi.fn() }));

vi.mock("#/hooks/use-breakpoint", () => ({ useBreakpoint: () => state.phone }));
vi.mock("react-router", async () => ({
  ...(await vi.importActual<object>("react-router")),
  useParams: () => ({ conversationId: "c1" }),
}));
vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: () => ({ data: { sandbox_status: "RUNNING" } }),
}));
vi.mock("#/hooks/use-agent-state", () => ({
  useAgentState: () => ({ curAgentState: "running" }),
}));
vi.mock("#/hooks/query/use-task-polling", () => ({
  useTaskPolling: () => ({ isTask: false, taskStatus: null }),
}));
vi.mock("#/hooks/mutation/use-unified-stop-conversation", () => ({
  useUnifiedPauseConversationSandbox: () => ({ mutate: state.pause }),
}));
vi.mock("#/hooks/mutation/use-unified-start-conversation", () => ({
  useUnifiedResumeConversationSandbox: () => ({ mutate: vi.fn() }),
}));
vi.mock("#/hooks/mutation/use-reopen-conversation", () => ({
  useReopenConversation: () => ({ mutate: vi.fn() }),
}));
vi.mock("#/hooks/use-user-providers", () => ({
  useUserProviders: () => ({ providers: [] }),
}));
vi.mock("#/components/features/conversation/conversation-name", () => ({
  ConversationName: () => <div data-testid="conversation-name" />,
}));
vi.mock("react-i18next", async () => ({
  ...(await vi.importActual<object>("react-i18next")),
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { ConversationNameWithStatus } from "#/components/features/conversation/conversation-name-with-status";

describe("ConversationNameWithStatus", () => {
  afterEach(() => {
    state.phone = true;
    vi.clearAllMocks();
  });

  it("on a phone, the status dot is a button that opens the sandbox menu", () => {
    render(<ConversationNameWithStatus />);
    expect(
      screen.queryByTestId("server-status-context-menu"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("server-status-dot"));

    const menu = screen.getByTestId("server-status-context-menu");
    expect(menu).not.toHaveClass("invisible");
    fireEvent.click(screen.getByTestId("stop-server-button"));
    expect(state.pause).toHaveBeenCalledWith({ conversationId: "c1" });
  });

  it("on a phone, a tap elsewhere closes it", () => {
    render(<ConversationNameWithStatus />);
    fireEvent.click(screen.getByTestId("server-status-dot"));
    fireEvent.click(document.body);
    expect(
      screen.queryByTestId("server-status-context-menu"),
    ).not.toBeInTheDocument();
  });

  it("on a desktop, keeps upstream's hover menu", () => {
    state.phone = false;
    render(<ConversationNameWithStatus />);
    expect(screen.queryByTestId("server-status-dot")).not.toBeInTheDocument();
    expect(screen.getByTestId("server-status-context-menu")).toHaveClass(
      "invisible",
    );
  });
});
