import { AgentStatus } from "#/components/features/controls/agent-status";
import { TurnActivity } from "#/components/features/controls/turn-activity";
import { Tools } from "../../controls/tools";
import { useUnifiedPauseConversationSandbox } from "#/hooks/mutation/use-unified-stop-conversation";
import { useConversationId } from "#/hooks/use-conversation-id";
import { useV1PauseConversation } from "#/hooks/mutation/use-v1-pause-conversation";
import { useV1ResumeConversation } from "#/hooks/mutation/use-v1-resume-conversation";
import { ChangeAgentButton } from "../change-agent-button";
import { SwitchAcpModelButton } from "../switch-acp-model-button";
import { SwitchProfileButton } from "../switch-profile-button";
import {
  JenticMode,
  useConversationJenticMode,
  useJenticModes,
} from "#/hooks/use-jentic-modes";

const MODE_BADGE: Record<JenticMode, { label: string; title: string }> = {
  chat: {
    label: "Chat",
    title:
      "Chat: no tools. Start a new conversation in Agent or Glue mode to run commands or edit files.",
  },
  agent: { label: "Agent", title: "Agent: terminal and file editor." },
  glue: {
    label: "Glue",
    title:
      "Glue: saved scripts (find, run, make), plus shell, read and write for one-offs.",
  },
};

interface ChatInputActionsProps {
  disabled: boolean;
}

export function ChatInputActions({ disabled }: ChatInputActionsProps) {
  const pauseConversationSandboxMutation = useUnifiedPauseConversationSandbox();
  const v1PauseConversationMutation = useV1PauseConversation();
  const v1ResumeConversationMutation = useV1ResumeConversation();
  const { conversationId } = useConversationId();
  // jentic-x: the conversation's Chat/Agent mode replaces the Plan chip (a planner would
  // bring the full toolset back).
  const modes = useJenticModes();
  const jenticMode = useConversationJenticMode(conversationId, modes);

  const handlePauseAgent = () => {
    // V1: Pause the conversation (agent execution)
    v1PauseConversationMutation.mutate({ conversationId });
  };

  const handleResumeAgentClick = () => {
    // V1: Resume the conversation (agent execution)
    v1ResumeConversationMutation.mutate({ conversationId });
  };

  const isPausing =
    pauseConversationSandboxMutation.isPending ||
    v1PauseConversationMutation.isPending;

  /*
   * Two rows, not one. At 384 px the buttons, the activity strip and the status
   * label do not fit on a line: flexbox squeezed the label to one character wide
   * and it came out reading downwards, twelve lines tall, which dragged the whole
   * composer over half the screen. The strip gets its own full-width line, the
   * buttons scroll sideways rather than shrink, and the status keeps its width.
   */
  return (
    <div className="w-full min-w-0 flex flex-col gap-1.5">
      <div className="w-full min-w-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 md:gap-4 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Tools />
          {modes ? (
            jenticMode && (
              <span
                data-testid="jentic-mode-badge"
                title={MODE_BADGE[jenticMode].title}
                className="shrink-0 rounded-full border border-[#3C3F45] px-2.5 py-1 text-xs leading-4 text-[#A3A3A3]"
              >
                {MODE_BADGE[jenticMode].label}
              </span>
            )
          ) : (
            <ChangeAgentButton />
          )}
          <SwitchProfileButton />
          <SwitchAcpModelButton />
        </div>
        <AgentStatus
          className="shrink-0"
          handleStop={handlePauseAgent}
          handleResumeAgent={handleResumeAgentClick}
          disabled={disabled}
          isPausing={isPausing}
        />
      </div>
      <TurnActivity />
    </div>
  );
}
