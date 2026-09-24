import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownRenderer } from "#/components/features/markdown/markdown-renderer";
import { useEventStore } from "#/stores/use-event-store";
import { AgentState } from "#/types/agent-state";

const { mockSend, agent } = vi.hoisted(() => ({ mockSend: vi.fn(), agent: { state: "finished" } }));
vi.mock("#/hooks/use-send-message", () => ({ useSendMessage: () => ({ send: mockSend }) }));
vi.mock("#/hooks/use-agent-state", () => ({ useAgentState: () => ({ curAgentState: agent.state }) }));
vi.mock("#/services/chat-service", () => ({ createChatMessage: (text: string) => ({ text }) }));

const block = (obj: unknown) => `Two ways to go:\n\n\`\`\`choices\n${JSON.stringify(obj)}\n\`\`\`\n`;
const agentSays = (text: string) => ({
  id: text.slice(0, 20), timestamp: "t", source: "agent",
  llm_message: { role: "assistant", content: [{ type: "text", text }] },
  activated_microagents: [], extended_content: [],
});
const userSays = (text: string) => ({ ...agentSays(text), source: "user", llm_message: { role: "user", content: [{ type: "text", text }] } });

const ONE = { question: "Which stack?", options: [{ label: "React + Vite", description: "fast" }, { label: "Plain HTML" }] };

describe("ChoicePicker in a message", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agent.state = AgentState.FINISHED;
  });

  it("one tap answers a single-choice question, with the option's own label", async () => {
    const md = block(ONE);
    useEventStore.setState({ events: [agentSays(md)] as never });
    render(<MarkdownRenderer>{md}</MarkdownRenderer>);
    expect(screen.getByText("Which stack?")).toBeInTheDocument();
    expect(screen.queryByText(/"question"/)).not.toBeInTheDocument(); // not shown as code
    await userEvent.click(screen.getByText("Plain HTML"));
    expect(mockSend).toHaveBeenCalledWith({ text: "My choice: Plain HTML" });
    expect(screen.getByText("Answer sent.")).toBeInTheDocument();
  });

  it("multiSelect collects picks and sends them with the button", async () => {
    const md = block({ question: "Extras?", multiSelect: true, options: ["lint", "ci", "docs"] });
    useEventStore.setState({ events: [agentSays(md)] as never });
    render(<MarkdownRenderer>{md}</MarkdownRenderer>);
    await userEvent.click(screen.getByText("lint"));
    await userEvent.click(screen.getByText("docs"));
    expect(mockSend).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("choice-send"));
    expect(mockSend).toHaveBeenCalledWith({ text: "My choices: lint; docs" });
  });

  it("Other sends the user's own words", async () => {
    const md = block(ONE);
    useEventStore.setState({ events: [agentSays(md)] as never });
    render(<MarkdownRenderer>{md}</MarkdownRenderer>);
    await userEvent.click(screen.getByTestId("choice-other"));
    await userEvent.type(screen.getByTestId("choice-other-text"), "Svelte");
    await userEvent.click(screen.getByTestId("choice-send"));
    expect(mockSend).toHaveBeenCalledWith({ text: "My choice: Svelte" });
  });

  it("an older message's choices are read-only, and so is a busy agent's", async () => {
    const md = block(ONE);
    useEventStore.setState({ events: [agentSays(md), userSays("never mind")] as never });
    const { unmount } = render(<MarkdownRenderer>{md}</MarkdownRenderer>);
    expect(screen.getAllByTestId("choice-option")[0]).toBeDisabled();
    unmount();
    useEventStore.setState({ events: [agentSays(md)] as never });
    agent.state = AgentState.RUNNING;
    render(<MarkdownRenderer>{md}</MarkdownRenderer>);
    expect(screen.getAllByTestId("choice-option")[0]).toBeDisabled();
  });

  it("a block that does not parse stays code", () => {
    const md = "```choices\n{broken\n```\n";
    render(<MarkdownRenderer>{md}</MarkdownRenderer>);
    expect(screen.queryByTestId("choice-picker")).not.toBeInTheDocument();
    expect(screen.getByText("{broken")).toBeInTheDocument();
  });
});
