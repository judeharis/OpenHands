import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueuedMessages } from "#/components/features/chat/queued-messages";
import { useQueuedMessageStore } from "#/stores/queued-message-store";

vi.mock("react-router", () => ({ useParams: () => ({ conversationId: "c1" }) }));

const msg = (text: string) => ({ role: "user" as const, content: [{ type: "text" as const, text }] });

describe("messages waiting for their agent", () => {
  beforeEach(() => useQueuedMessageStore.setState({ items: [] }));

  it("shows this conversation's queued messages and lets one be withdrawn", async () => {
    const { add } = useQueuedMessageStore.getState();
    add({ conversationId: "c1", target: "plan", message: msg("use a while loop"), text: "use a while loop" });
    add({ conversationId: "other", target: "main", message: msg("elsewhere"), text: "elsewhere" });
    render(<QueuedMessages />);

    expect(screen.getByTestId("queued-messages")).toHaveTextContent("For the planner, when it is up:");
    expect(screen.getByText("use a while loop")).toBeInTheDocument();
    expect(screen.queryByText("elsewhere")).toBeNull();

    await userEvent.click(screen.getByLabelText("Withdraw this message"));
    expect(useQueuedMessageStore.getState().items.map((i) => i.text)).toEqual(["elsewhere"]);
  });
});
