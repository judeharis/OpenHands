import { useMutation, useQueryClient } from "@tanstack/react-query";
import V1ConversationService from "#/api/conversation-service/v1-conversation-service.api";
import { invalidateConversationQueries } from "./conversation-mutation-utils";

const POLL_MS = 2000;
const MAX_POLLS = 90; // 3 minutes; the app's own sandbox startup timeout is 120 s

/** The placeholder the app writes on every (re)start, e.g. "Conversation 0e896". */
const PLACEHOLDER_TITLE = /^Conversation [0-9a-f]{5}$/;

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Reopen a conversation whose sandbox is MISSING (container removed) or
 * ERROR (container cannot be resumed): a fresh sandbox is started for the
 * same conversation id, the agent-server rehydrates the history from the
 * workspace mount, and the app points the conversation at the new sandbox.
 *
 * The app resets the title to a placeholder when it saves the conversation
 * again, so the previous title is put back afterwards.
 */
export const useReopenConversation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["reopen-conversation"],
    mutationFn: async ({ conversationId }: { conversationId: string }) => {
      const [before] = await V1ConversationService.batchGetAppConversations([
        conversationId,
      ]);
      const previousTitle = before?.title ?? null;

      const startTask =
        await V1ConversationService.reopenConversation(conversationId);
      let task = await V1ConversationService.getStartTask(startTask.id);
      let polls = 0;
      /* eslint-disable no-await-in-loop */
      while (
        task &&
        !["READY", "ERROR"].includes(task.status) &&
        polls < MAX_POLLS
      ) {
        await sleep(POLL_MS);
        task = await V1ConversationService.getStartTask(startTask.id);
        polls += 1;
      }
      /* eslint-enable no-await-in-loop */
      if (!task || task.status !== "READY") {
        throw new Error(task?.detail || "Failed to reopen the conversation");
      }

      if (previousTitle && !PLACEHOLDER_TITLE.test(previousTitle)) {
        await V1ConversationService.updateConversationTitle(
          conversationId,
          previousTitle,
        );
      }
      return conversationId;
    },
    onSuccess: (_data, variables) => {
      invalidateConversationQueries(queryClient, variables.conversationId);
      // The archived view cached the app-server mirror; the live socket replays now.
      queryClient.removeQueries({
        queryKey: ["conversation-history", variables.conversationId],
      });
    },
  });
};
