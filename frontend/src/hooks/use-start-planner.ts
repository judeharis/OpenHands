import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useConversationStore } from "#/stores/conversation-store";
import { useCreateConversation } from "#/hooks/mutation/use-create-conversation";
import { useUnifiedUploadFiles } from "#/hooks/mutation/use-unified-upload-files";
import { useUpdateConversation } from "#/hooks/mutation/use-update-conversation";
import { convertImageToBase64 } from "#/utils/convert-image-to-base-64";
import { displayErrorToast } from "#/utils/custom-toast-handlers";
import { setConversationState } from "#/utils/conversation-local-storage";
import { PendingFirstMessage } from "#/stores/pending-first-message-store";

const TITLE_CHARS = 60;

/**
 * Fork: a home-screen Plan, started inside the code conversation it will be built in.
 *
 * The planner is a sub-conversation of that code conversation, created with the first
 * message, the way upstream's in-chat Plan chip creates one: its events join the same
 * chat, messages in plan mode go to it, and Build switches the mode back to code and
 * tells the code agent to execute PLAN.md (use-handle-build-plan-click). The user sees
 * one conversation throughout. Before this, a home Plan was a top-level planner and Build
 * had to start a second conversation.
 *
 * Files are uploaded into the shared sandbox first, as the chat does for any message.
 * The conversation is named after the message, since its own first message is the
 * build step, which is not what it is about.
 */
export const useStartPlanner = () => {
  const { t } = useTranslation();
  const { setConversationMode, setSubConversationTaskId } =
    useConversationStore();
  const { mutate: createConversation } = useCreateConversation();
  const { mutateAsync: uploadFiles } = useUnifiedUploadFiles();
  const { mutate: rename } = useUpdateConversation();

  return useCallback(
    async (conversationId: string, pending: PendingFirstMessage) => {
      setConversationMode("plan");
      setConversationState(conversationId, { conversationMode: "plan" });

      let imageUrls: string[] = [];
      let uploadedFiles: string[] = [];
      try {
        imageUrls = await Promise.all(pending.images.map(convertImageToBase64));
        if (pending.files.length > 0) {
          const result = await uploadFiles({
            conversationId,
            files: pending.files,
          });
          result.skipped_files.forEach((f) => displayErrorToast(f.reason));
          uploadedFiles = result.uploaded_files;
        }
      } catch {
        displayErrorToast("Could not attach the files to the plan");
      }

      const filePrompt = `${t("CHAT_INTERFACE$AUGMENTED_PROMPT_FILES_TITLE")}: ${uploadedFiles.join("\n\n")}`;
      const query =
        uploadedFiles.length > 0
          ? `${pending.text}\n\n${filePrompt}`
          : pending.text;

      createConversation(
        {
          parentConversationId: conversationId,
          agentType: "plan",
          query: query || undefined,
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        },
        {
          onSuccess: (data) => {
            if (!data.v1_task_id) return;
            setSubConversationTaskId(data.v1_task_id);
            setConversationState(conversationId, {
              subConversationTaskId: data.v1_task_id,
            });
          },
        },
      );

      const title = pending.text.trim().split("\n")[0].slice(0, TITLE_CHARS);
      if (title) rename({ conversationId, newTitle: title });
    },
    [
      createConversation,
      rename,
      setConversationMode,
      setSubConversationTaskId,
      t,
      uploadFiles,
    ],
  );
};
