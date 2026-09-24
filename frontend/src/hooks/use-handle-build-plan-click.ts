import { useCallback } from "react";
import { useConversationStore } from "#/stores/conversation-store";
import { useSendMessage } from "#/hooks/use-send-message";
import { createChatMessage } from "#/services/chat-service";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import V1ConversationService from "#/api/conversation-service/v1-conversation-service.api";
import { useEventStore } from "#/stores/use-event-store";
import {
  buildStepMessage,
  planFromReplies,
  useBuildInCodeAgent,
} from "#/hooks/use-build-in-code-agent";

/**
 * Custom hook that encapsulates the logic for handling the Build button click.
 * Switches to code mode and tells the code agent to execute the plan.
 *
 * Fork: the switch is internal. The message to the code agent is the Build step
 * (use-build-in-code-agent), which the chat does not show, rather than upstream's
 * "Execute the plan based on the .agents_tmp/PLAN.md file." as if the user had typed it.
 *
 * @returns An object containing handleBuildClick function
 */
export const useHandleBuildPlanClick = () => {
  const { setConversationMode, planContent } = useConversationStore();
  const { send } = useSendMessage();
  const { data: conversation } = useActiveConversation();
  const { isPlanConversation, buildInCodeAgent } = useBuildInCodeAgent();

  const handleBuildPlanClick = useCallback(
    async (event?: React.MouseEvent<HTMLButtonElement> | KeyboardEvent) => {
      event?.preventDefault();
      event?.stopPropagation();

      // A conversation started as a planner (before plans started inside a code
      // conversation) has no code agent to switch to: hand over to a new code
      // conversation in the same sandbox instead (see use-build-in-code-agent).
      if (isPlanConversation) {
        buildInCodeAgent();
        return;
      }

      // Switch to code mode
      setConversationMode("code");

      // PLAN.md, or failing that the planner's longest reply: the code agent never saw it.
      let planWritten = !!planContent;
      if (!planWritten && conversation) {
        try {
          planWritten = !!(
            await V1ConversationService.readConversationFile(conversation.id)
          ).trim();
        } catch {
          planWritten = false;
        }
      }
      const plannerEvents = useEventStore
        .getState()
        .events.filter((e) => e.isFromPlanningAgent);

      const timestamp = new Date().toISOString();
      send(
        createChatMessage(
          buildStepMessage(planWritten, planFromReplies(plannerEvents)),
          [],
          [],
          timestamp,
        ),
      );
    },
    [
      setConversationMode,
      send,
      conversation,
      planContent,
      isPlanConversation,
      buildInCodeAgent,
    ],
  );

  return { handleBuildPlanClick };
};
