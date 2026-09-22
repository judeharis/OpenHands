import { useTranslation } from "react-i18next";
import RefreshIcon from "#/icons/u-refresh.svg?react";
import { useUnifiedGetGitChanges } from "#/hooks/query/use-unified-get-git-changes";
import { useHandleBuildPlanClick } from "#/hooks/use-handle-build-plan-click";
import { useAgentState } from "#/hooks/use-agent-state";
import { useConversationStore } from "#/stores/conversation-store";
import { AgentState } from "#/types/agent-state";
import { I18nKey } from "#/i18n/declaration";
import { cn } from "#/utils/utils";
import { Typography } from "#/ui/typography";
import { useBreakpoint } from "#/hooks/use-breakpoint";
import { useConversationId } from "#/hooks/use-conversation-id";
import { useConversationLocalStorageState } from "#/utils/conversation-local-storage";

type ConversationTabTitleProps = {
  title: string;
  conversationKey: string;
};

/* eslint-disable i18next/no-literal-string */
export function ConversationTabTitle({
  title,
  conversationKey,
}: ConversationTabTitleProps) {
  const { t } = useTranslation();
  const { refetch, isFetching } = useUnifiedGetGitChanges();
  const { handleBuildPlanClick } = useHandleBuildPlanClick();
  const { curAgentState } = useAgentState();
  const { planContent, setHasRightPanelToggled } = useConversationStore();
  const isMobile = useBreakpoint();
  const { conversationId } = useConversationId();
  const { setRightPanelShown } =
    useConversationLocalStorageState(conversationId);

  // On a phone this bar heads a full-screen sheet; this is the way back to the chat.
  const closeSheet = () => {
    setHasRightPanelToggled(false);
    setRightPanelShown(false);
  };

  const handleRefresh = () => {
    refetch();
  };

  // Determine if Build button should be disabled
  const isAgentRunning =
    curAgentState === AgentState.RUNNING ||
    curAgentState === AgentState.LOADING;
  const isBuildDisabled = isAgentRunning || !planContent;

  return (
    <div className="flex flex-row items-center justify-between gap-2 border-b border-[#474A54] py-2 px-3">
      {isMobile ? (
        <button
          type="button"
          onClick={closeSheet}
          data-testid="tab-sheet-back"
          className="flex items-center gap-2 min-h-9 -ml-1 pr-2 text-sm font-medium text-white cursor-pointer"
        >
          <span aria-hidden="true">←</span>
          {t(I18nKey.CONVERSATION$BACK_TO_CHAT)}
          <span className="text-neutral-400">· {title}</span>
        </button>
      ) : (
        <span className="text-xs font-medium text-white">{title}</span>
      )}
      {conversationKey === "editor" && (
        <button
          type="button"
          className="flex w-[26px] py-1 justify-center items-center gap-[10px] rounded-[7px] hover:enabled:bg-[#474A54] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleRefresh}
          disabled={isFetching}
        >
          <RefreshIcon
            width={12.75}
            height={15}
            color="#ffffff"
            className={isFetching ? "animate-spin" : ""}
          />
        </button>
      )}
      {conversationKey === "planner" && (
        <button
          type="button"
          onClick={handleBuildPlanClick}
          disabled={isBuildDisabled}
          className={cn(
            "flex items-center justify-center h-5 min-w-17 px-2 rounded bg-white transition-opacity",
            isMobile && "h-9 px-4",
            isBuildDisabled
              ? "opacity-50 cursor-not-allowed"
              : "hover:opacity-90 cursor-pointer",
          )}
          data-testid="planner-tab-build-button"
        >
          <Typography.Text
            className={cn(
              "text-black font-medium leading-5",
              isMobile ? "text-sm" : "text-[11px]",
            )}
          >
            {t(I18nKey.COMMON$BUILD)}
            {/* keyboard hint only where a keyboard is likely */}
            <span className="hidden [@media(hover:hover)_and_(pointer:fine)]:inline">
              {" "}
              ⌘↩
            </span>
          </Typography.Text>
        </button>
      )}
    </div>
  );
}
