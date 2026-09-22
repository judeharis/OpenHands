import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { I18nKey } from "#/i18n/declaration";
import { useReopenConversation } from "#/hooks/mutation/use-reopen-conversation";
import { useUnifiedResumeConversationSandbox } from "#/hooks/mutation/use-unified-start-conversation";
import { useUserProviders } from "#/hooks/use-user-providers";
import { displayErrorToast } from "#/utils/custom-toast-handlers";

/**
 * Shown when the sandbox reports ERROR: its container exists but the
 * agent-server does not answer the health probe. Retry resumes it (a
 * stopped container docker-starts again); Reopen starts a fresh sandbox
 * for the same conversation when the old one is beyond help.
 */
export function SandboxErrorBanner() {
  const { t } = useTranslation();
  const { conversationId } = useParams<{ conversationId: string }>();
  const { providers } = useUserProviders();
  const { mutate: resume, isPending: isResuming } =
    useUnifiedResumeConversationSandbox();
  const { mutate: reopen, isPending: isReopening } = useReopenConversation();

  if (!conversationId) return null;
  const busy = isResuming || isReopening;

  return (
    <div
      data-testid="sandbox-error-banner"
      className="flex flex-wrap items-center justify-center gap-3 px-4 py-3 rounded-lg bg-red-950/60 border border-red-800"
    >
      <span className="text-sm text-neutral-200">
        {t(I18nKey.CONVERSATION$SANDBOX_ERROR)}
      </span>
      <button
        type="button"
        disabled={busy}
        data-testid="sandbox-retry-button"
        onClick={() =>
          resume(
            { conversationId, providers },
            { onError: (error) => displayErrorToast(error.message) },
          )
        }
        className="min-h-9 px-4 rounded-md border border-neutral-400 text-white text-sm font-medium disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        {t(I18nKey.COMMON$RETRY)}
      </button>
      <button
        type="button"
        disabled={busy}
        data-testid="reopen-conversation-button"
        onClick={() =>
          reopen(
            { conversationId },
            { onError: (error) => displayErrorToast(error.message) },
          )
        }
        className="min-h-9 px-4 rounded-md bg-white text-black text-sm font-medium disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        {isReopening
          ? t(I18nKey.CONVERSATION$REOPENING)
          : t(I18nKey.CONVERSATION$REOPEN)}
      </button>
    </div>
  );
}
