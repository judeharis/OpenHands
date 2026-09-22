import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { V1ConfirmationButtons } from "#/components/shared/buttons/v1-confirmation-buttons";
import { AgentState } from "#/types/agent-state";
import { useEventStore } from "#/stores/use-event-store";
import { useEventMessageStore } from "#/stores/event-message-store";
import { usePolicyStore } from "#/stores/policy-store";
import { useRespondToConfirmation } from "#/hooks/mutation/use-respond-to-confirmation";
import { useGrantSessionAllow } from "#/hooks/mutation/use-grant-session-allow";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${JSON.stringify(opts)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));
vi.mock("#/hooks/use-agent-state", () => ({
  useAgentState: () => ({
    curAgentState: AgentState.AWAITING_USER_CONFIRMATION,
  }),
}));
vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: () => ({
    data: {
      id: "conv-1",
      conversation_url: "http://localhost:40000/sb/1/api/conversations/conv-1",
      session_api_key: "k",
      sub_conversation_ids: [],
    },
  }),
}));
vi.mock("#/hooks/query/use-sub-conversations", () => ({
  useSubConversations: () => ({ data: [] }),
}));
vi.mock("#/hooks/mutation/use-respond-to-confirmation");
vi.mock("#/hooks/mutation/use-grant-session-allow");
vi.mock("#/components/v1/chat/event-content-helpers/get-event-content", () => ({
  getEventContent: (ev: {
    action: { kind: string; path?: string; command?: string };
  }) => ({
    title: `${ev.action.kind} ${ev.action.path ?? ev.action.command ?? ""}`,
    details: "",
  }),
}));

const action = (
  id: string,
  action: Record<string, unknown>,
  tool = "file_editor",
) =>
  ({
    id,
    timestamp: "2026-09-22T00:00:00Z",
    source: "agent",
    thought: [],
    action,
    tool_name: tool,
    tool_call_id: `call-${id}`,
    tool_call: { id: `call-${id}`, name: tool, arguments: "{}" },
    llm_response_id: "resp-1",
    security_risk: "UNKNOWN",
  }) as never;

const observationFor = (actionId: string) =>
  ({
    id: `obs-${actionId}`,
    timestamp: "2026-09-22T00:00:01Z",
    source: "environment",
    action_id: actionId,
    tool_name: "file_editor",
    tool_call_id: `call-${actionId}`,
    observation: { kind: "FileEditorObservation" },
  }) as never;

const wrap = (ui: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
);

describe("V1ConfirmationButtons", () => {
  const respond = vi.fn();
  const grant = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom has neither scrollIntoView nor matchMedia
    Element.prototype.scrollIntoView = () => {};
    // jsdom has no matchMedia; the buttons ask it whether a keyboard is likely
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: () => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
    vi.mocked(useRespondToConfirmation).mockReturnValue({
      mutate: respond,
    } as never);
    vi.mocked(useGrantSessionAllow).mockReturnValue({
      mutate: grant,
      isPending: false,
    } as never);
    useEventMessageStore.setState({
      v1SubmittedEventIds: [],
      acceptedFingerprints: [],
    });
    usePolicyStore.setState({ byConversation: {} });
    useEventStore.setState({
      events: [
        action("a0", {
          kind: "FileEditorAction",
          command: "view",
          path: "/workspace/project/x.txt",
        }),
        observationFor("a0"),
        action("a1", {
          kind: "FileEditorAction",
          command: "create",
          path: "/workspace/project/t3/App.jsx",
          file_text: "a\nb\nc",
        }),
        action(
          "a2",
          { kind: "TerminalAction", command: "npm install --no-audit" },
          "terminal",
        ),
      ],
    } as never);
  });

  it("lists every unanswered action of the batch, with what it does and where", () => {
    render(wrap(<V1ConfirmationButtons />));
    const panel = screen.getByTestId("v1-confirmation-panel");
    expect(panel.getAttribute("data-count")).toBe("2");
    expect(panel.getAttribute("data-risk")).toBe("medium");
    expect(panel.textContent).toContain("t3/App.jsx");
    expect(panel.textContent).not.toContain("x.txt");
  });

  it("Continue answers the whole batch once", () => {
    render(wrap(<V1ConfirmationButtons />));
    fireEvent.click(screen.getByTestId("action-confirm-button"));
    expect(respond).toHaveBeenCalledTimes(1);
    expect(respond.mock.calls[0][0]).toMatchObject({
      conversationId: "conv-1",
      accept: true,
    });
    expect(screen.getByTestId("v1-confirmation-sent")).toBeTruthy();
  });

  it("Allow for session grants the suggested prefixes, then continues", () => {
    render(wrap(<V1ConfirmationButtons />));
    expect(screen.getByTestId("v1-allow-hint").textContent).toContain("t3/");
    fireEvent.click(screen.getByTestId("action-allow-session-button"));
    expect(grant).toHaveBeenCalledTimes(1);
    expect(grant.mock.calls[0][0].grants).toEqual([
      "write:/workspace/project/t3/",
      "cmd:npm install",
    ]);
    act(() => grant.mock.calls[0][1].onSuccess());
    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({ accept: true }),
    );
  });

  it("a rejection can carry a reason the agent reads", () => {
    render(wrap(<V1ConfirmationButtons />));
    fireEvent.click(screen.getByTestId("action-reject-reason-button"));
    fireEvent.change(screen.getByTestId("action-reject-reason-input"), {
      target: { value: "use TypeScript" },
    });
    fireEvent.click(screen.getByTestId("action-reject-with-reason-button"));
    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({ accept: false, reason: "use TypeScript" }),
    );
    expect(screen.getByTestId("v1-confirmation-sent").textContent).toContain(
      "use TypeScript",
    );
  });

  it("does not ask twice for a batch identical to one already approved", () => {
    const { unmount } = render(wrap(<V1ConfirmationButtons />));
    fireEvent.click(screen.getByTestId("action-confirm-button"));
    unmount();
    // the same two actions come back as a new batch
    useEventMessageStore.setState({ v1SubmittedEventIds: [] });
    useEventStore.setState({
      events: [
        action("b1", {
          kind: "FileEditorAction",
          command: "create",
          path: "/workspace/project/t3/App.jsx",
          file_text: "a\nb\nc",
        }),
        action(
          "b2",
          { kind: "TerminalAction", command: "npm install --no-audit" },
          "terminal",
        ),
      ],
    } as never);
    render(wrap(<V1ConfirmationButtons />));
    expect(respond).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("v1-confirmation-sent").textContent).toContain(
      "AUTO_APPROVED_SAME",
    );
  });

  it("paints anything outside the workspace red and offers no Allow", () => {
    useEventStore.setState({
      events: [
        action("c1", {
          kind: "FileEditorAction",
          command: "create",
          path: "/etc/cron.d/x",
          file_text: "x",
        }),
      ],
    } as never);
    render(wrap(<V1ConfirmationButtons />));
    expect(
      screen.getByTestId("v1-confirmation-panel").getAttribute("data-risk"),
    ).toBe("high");
    expect(screen.getByTestId("workspace-path-outside")).toBeTruthy();
    expect(screen.queryByTestId("action-allow-session-button")).toBeNull();
  });
});
