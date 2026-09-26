import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TOAST_OPTIONS } from "#/utils/custom-toast-handlers";
import { I18nKey } from "#/i18n/declaration";
import {
  deleteV1ConversationSandbox,
  invalidateConversationQueries,
  updateConversationSandboxStatusInCache,
} from "./conversation-mutation-utils";

/**
 * Hook to delete a conversation's sandbox, keeping the conversation.
 *
 * The container goes; the conversation shows as archived (MISSING) and its
 * Reopen button starts a fresh sandbox on the history kept in the workspace.
 * Unlike stopping, this does not leave the page: the archived banner is where
 * Reopen lives.
 */
export const useDeleteConversationSandbox = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["delete-conversation-sandbox"],
    mutationFn: async (variables: { conversationId: string }) =>
      deleteV1ConversationSandbox(variables.conversationId),
    onMutate: () => ({
      toastId: toast.loading(t(I18nKey.TOAST$DELETING_SANDBOX), TOAST_OPTIONS),
    }),
    onError: (_, __, context) => {
      if (context?.toastId) {
        toast.dismiss(context.toastId);
      }
      toast.error(t(I18nKey.TOAST$FAILED_TO_DELETE_SANDBOX), TOAST_OPTIONS);
    },
    onSuccess: (_, variables, context) => {
      if (context?.toastId) {
        toast.dismiss(context.toastId);
      }
      toast.success(t(I18nKey.TOAST$SANDBOX_DELETED), TOAST_OPTIONS);

      updateConversationSandboxStatusInCache(
        queryClient,
        variables.conversationId,
        "MISSING",
      );
      // Other conversations that shared the sandbox are archived too
      invalidateConversationQueries(queryClient, variables.conversationId);
    },
  });
};
