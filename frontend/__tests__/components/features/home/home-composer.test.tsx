import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeComposer } from "#/components/features/home/home-composer";

const createConversation = vi.fn();

vi.mock("react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("#/hooks/mutation/use-create-conversation", () => ({
  useCreateConversation: () => ({
    mutate: createConversation,
    isPending: false,
    isSuccess: false,
  }),
}));
vi.mock("#/hooks/use-is-creating-conversation", () => ({
  useIsCreatingConversation: () => false,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

beforeEach(() => {
  createConversation.mockReset();
});

describe("starting a conversation from the home screen (jentic)", () => {
  // The agent type can only be set when the conversation is created, so without this
  // control the only way into plan mode was jentic-cli.
  it("starts in code mode by default", async () => {
    render(<HomeComposer />);
    await userEvent.type(screen.getByTestId("home-composer"), "build a thing");
    await userEvent.click(screen.getByTestId("submit-button"));

    await waitFor(() => expect(createConversation).toHaveBeenCalled());
    expect(createConversation.mock.calls[0][0]).toMatchObject({
      query: "build a thing",
      agentType: "default",
    });
  });

  it("starts in plan mode when plan is chosen", async () => {
    render(<HomeComposer />);
    await userEvent.click(screen.getByTestId("home-mode-plan"));
    await userEvent.type(screen.getByTestId("home-composer"), "ship a feature");
    await userEvent.click(screen.getByTestId("submit-button"));

    await waitFor(() => expect(createConversation).toHaveBeenCalled());
    expect(createConversation.mock.calls[0][0]).toMatchObject({
      query: "ship a feature",
      agentType: "plan",
    });
  });

  it("carries the choice into an empty conversation too", async () => {
    render(<HomeComposer />);
    await userEvent.click(screen.getByTestId("home-mode-plan"));
    await userEvent.click(screen.getByTestId("launch-new-conversation-button"));

    await waitFor(() => expect(createConversation).toHaveBeenCalled());
    expect(createConversation.mock.calls[0][0]).toMatchObject({
      query: undefined,
      agentType: "plan",
    });
  });

  it("says which mode is selected, for a screen reader too", async () => {
    render(<HomeComposer />);
    expect(screen.getByTestId("home-mode-default")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("home-mode-plan")).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(screen.getByTestId("home-mode-plan"));
    expect(screen.getByTestId("home-mode-plan")).toHaveAttribute("aria-pressed", "true");
  });
});
