import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { I18nKey } from "#/i18n/declaration";
import { useReopenConversation } from "#/hooks/mutation/use-reopen-conversation";
import { displayErrorToast } from "#/utils/custom-toast-handlers";

export function ArchivedBanner() {
  const { t } = useTranslation();
  const { conversationId } = useParams<{ conversationId: string }>();
  const { mutate: reopen, isPending } = useReopenConversation();

  const handleReopen = () => {
    if (!conversationId) return;
    reopen(
      { conversationId },
      { onError: (error) => displayErrorToast(error.message) },
    );
  };

  return (
    <div
      data-testid="archived-banner"
      className="flex flex-wrap items-center justify-center gap-3 px-4 py-3 rounded-lg bg-neutral-700 border border-neutral-600"
    >
      <span className="text-sm text-neutral-300">
        {t(I18nKey.CONVERSATION$ARCHIVED_READ_ONLY)}
      </span>
      {conversationId && (
        <button
          type="button"
          onClick={handleReopen}
          disabled={isPending}
          data-testid="reopen-conversation-button"
          className="min-h-9 px-4 rounded-md bg-white text-black text-sm font-medium disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {isPending
            ? t(I18nKey.CONVERSATION$REOPENING)
            : t(I18nKey.CONVERSATION$REOPEN)}
        </button>
      )}
    </div>
  );
}
