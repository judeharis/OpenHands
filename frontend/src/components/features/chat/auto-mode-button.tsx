import { useTranslation } from "react-i18next";
import { Typography } from "#/ui/typography";
import { I18nKey } from "#/i18n/declaration";
import PlayIcon from "#/icons/play.svg?react";
import LockIcon from "#/icons/lock.svg?react";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useSubConversations } from "#/hooks/query/use-sub-conversations";
import { useSetAutoMode } from "#/hooks/mutation/use-set-auto-mode";
import { LLMKIT_ANALYZER_KIND } from "#/hooks/use-ensure-llmkit-policy";
import { usePolicyStore } from "#/stores/policy-store";
import { displayErrorToast } from "#/utils/custom-toast-handlers";
import { cn } from "#/utils/utils";

/**
 * Auto mode, per conversation: "Asks" (writes and unknown commands wait for a
 * tap) or "Auto" (the agent works in its sandbox unasked; pushing, uploading,
 * network floods and the download budget still ask). Shown once the kit's
 * policy is in place on the sandbox; applies to the planner too.
 */
export function AutoModeButton() {
  const { t } = useTranslation();
  const { data: conversation } = useActiveConversation();
  const { data: subConversations } = useSubConversations(
    conversation?.sub_conversation_ids ?? [],
  );
  const entry = usePolicyStore((state) =>
    conversation ? state.byConversation[conversation.id] : undefined,
  );
  const { mutate: setAutoMode, isPending } = useSetAutoMode();

  if (
    !conversation ||
    conversation.agent_kind === "acp" ||
    entry?.kind !== LLMKIT_ANALYZER_KIND
  )
    return null;

  const auto = !!entry.auto;
  const handleClick = () => {
    const targets = [conversation, ...(subConversations ?? [])].filter(
      (c): c is NonNullable<typeof c> =>
        !!c && c.sandbox_status === "RUNNING" && !!c.conversation_url,
    );
    setAutoMode(
      { targets, auto: !auto },
      { onError: (error) => displayErrorToast(error.message) },
    );
  };
  const Icon = auto ? PlayIcon : LockIcon;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      data-testid="auto-mode-button"
      data-auto={auto}
      aria-pressed={auto}
      title={t(
        auto
          ? I18nKey.POLICY$AUTO_MODE_ON_TITLE
          : I18nKey.POLICY$AUTO_MODE_OFF_TITLE,
      )}
      className={cn(
        "flex items-center gap-1 border rounded-[100px] transition-opacity cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed px-2 shrink-0",
        auto ? "border-amber-500 bg-amber-500/15" : "border-[#4B505F]",
      )}
    >
      <Icon
        width={14}
        height={14}
        color={auto ? "#f59e0b" : "#ffffff"}
        className="shrink-0"
      />
      <Typography.Text
        className={cn(
          "text-2.75 not-italic font-normal leading-5",
          auto ? "text-amber-400" : "text-white",
        )}
      >
        {t(auto ? I18nKey.POLICY$AUTO_MODE : I18nKey.POLICY$ASK_MODE)}
      </Typography.Text>
    </button>
  );
}
