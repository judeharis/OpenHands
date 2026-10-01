import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AutoModeButton } from "#/components/features/chat/auto-mode-button";
import { usePolicyStore } from "#/stores/policy-store";
import { useSetAutoMode } from "#/hooks/mutation/use-set-auto-mode";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
const conversation = {
  id: "conv-1",
  conversation_url: "http://localhost:40000/sb/1/api/conversations/conv-1",
  session_api_key: "k",
  sandbox_status: "RUNNING",
  sub_conversation_ids: ["plan-1"],
};
const planner = {
  ...conversation,
  id: "plan-1",
  conversation_url: "http://localhost:40000/sb/1/api/conversations/plan-1",
};
vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: () => ({ data: conversation }),
}));
vi.mock("#/hooks/query/use-sub-conversations", () => ({
  useSubConversations: () => ({ data: [planner, null] }),
}));
vi.mock("#/hooks/mutation/use-set-auto-mode");

describe("AutoModeButton", () => {
  const mutate = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSetAutoMode).mockReturnValue({
      mutate,
      isPending: false,
    } as never);
    usePolicyStore.setState({ byConversation: {} });
  });

  it("is hidden until the kit's policy is on the sandbox", () => {
    render(<AutoModeButton />);
    expect(screen.queryByTestId("auto-mode-button")).toBeNull();
  });

  it("shows Asks, and switches the conversation and its planner to auto", () => {
    usePolicyStore.setState({
      byConversation: { "conv-1": { kind: "LlmkitAnalyzer", grants: [] } },
    });
    render(<AutoModeButton />);
    const button = screen.getByTestId("auto-mode-button");
    expect(button.textContent).toBe("POLICY$ASK_MODE");
    fireEvent.click(button);
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0].auto).toBe(true);
    expect(
      mutate.mock.calls[0][0].targets.map((t: { id: string }) => t.id),
    ).toEqual(["conv-1", "plan-1"]);
  });

  it("shows Auto when it is on, and switches it off", () => {
    usePolicyStore.setState({
      byConversation: {
        "conv-1": { kind: "LlmkitAnalyzer", grants: [], auto: true },
      },
    });
    render(<AutoModeButton />);
    const button = screen.getByTestId("auto-mode-button");
    expect(button.getAttribute("data-auto")).toBe("true");
    expect(button.textContent).toBe("POLICY$AUTO_MODE");
    fireEvent.click(button);
    expect(mutate.mock.calls[0][0].auto).toBe(false);
  });
});
