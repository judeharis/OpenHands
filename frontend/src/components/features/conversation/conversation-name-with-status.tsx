import React from "react";
import { useParams } from "react-router";
import { useAgentState } from "#/hooks/use-agent-state";
import { useTaskPolling } from "#/hooks/query/use-task-polling";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useUnifiedPauseConversationSandbox } from "#/hooks/mutation/use-unified-stop-conversation";
import { useUnifiedResumeConversationSandbox } from "#/hooks/mutation/use-unified-start-conversation";
import { useReopenConversation } from "#/hooks/mutation/use-reopen-conversation";
import { useUserProviders } from "#/hooks/use-user-providers";
import { useBreakpoint } from "#/hooks/use-breakpoint";
import { getStatusColor } from "#/utils/utils";
import { AgentState } from "#/types/agent-state";
import DebugStackframeDot from "#/icons/debug-stackframe-dot.svg?react";
import { ServerStatusContextMenu } from "../controls/server-status-context-menu";
import { ConversationName } from "./conversation-name";

export function ConversationNameWithStatus() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { data: conversation } = useActiveConversation();
  const { curAgentState } = useAgentState();
  const { isTask, taskStatus } = useTaskPolling();
  const { mutate: pauseConversationSandbox } =
    useUnifiedPauseConversationSandbox();
  const { mutate: resumeConversationSandbox } =
    useUnifiedResumeConversationSandbox();
  const { mutate: reopenConversation } = useReopenConversation();
  const { providers } = useUserProviders();
  const isPhone = useBreakpoint();
  const [statusMenuOpen, setStatusMenuOpen] = React.useState(false);

  const isStartingStatus =
    curAgentState === AgentState.LOADING || curAgentState === AgentState.INIT;
  const isStopStatus = conversation?.sandbox_status === "MISSING";

  const statusColor = getStatusColor({
    isPausing: false,
    isTask,
    taskStatus,
    isStartingStatus,
    isStopStatus,
    curAgentState,
  });

  const handleStopServer = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (conversationId) {
      pauseConversationSandbox({ conversationId });
    }
  };

  const handleStartServer = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!conversationId) return;
    // A MISSING sandbox has no container left to resume: start a fresh one for
    // the same conversation instead. Everything else is a plain resume.
    if (conversation?.sandbox_status === "MISSING") {
      reopenConversation({ conversationId });
    } else {
      resumeConversationSandbox({ conversationId, providers });
    }
  };

  const dot = (
    <DebugStackframeDot
      className="ml-[3.5px] w-6 h-6 cursor-pointer"
      color={statusColor}
    />
  );

  return (
    <div className="flex items-center min-w-0">
      <div className="group relative shrink-0">
        {isPhone ? (
          // Fork: upstream shows this menu on hover, which a phone does not have, and the
          // title box clipped it anyway. On a phone the dot is a button.
          <button
            type="button"
            aria-label="Sandbox status"
            aria-expanded={statusMenuOpen}
            data-testid="server-status-dot"
            className="flex"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setStatusMenuOpen((open) => !open);
            }}
          >
            {dot}
          </button>
        ) : (
          dot
        )}
        {(!isPhone || statusMenuOpen) && (
          <ServerStatusContextMenu
            onClose={isPhone ? () => setStatusMenuOpen(false) : () => {}}
            onStopServer={
              conversation?.sandbox_status === "RUNNING"
                ? handleStopServer
                : undefined
            }
            onStartServer={
              conversation?.sandbox_status === "MISSING"
                ? handleStartServer
                : undefined
            }
            sandboxStatus={conversation?.sandbox_status ?? null}
            position="bottom"
            className={
              isPhone
                ? "left-0 mt-1 min-h-fit"
                : "opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto bottom-full left-0 mt-0 min-h-fit"
            }
            isPausing={false}
          />
        )}
      </div>
      <ConversationName />
    </div>
  );
}
