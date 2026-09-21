import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import { AgentState } from "#/types/agent-state";
import { ActionTooltip } from "../action-tooltip";
import { RiskAlert } from "#/components/shared/risk-alert";
import WarningIcon from "#/icons/u-warning.svg?react";
import { useEventMessageStore } from "#/stores/event-message-store";
import { useEventStore } from "#/stores/use-event-store";
import { isV1Event, isActionEvent } from "#/types/v1/type-guards";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useSubConversations } from "#/hooks/query/use-sub-conversations";
import { useAgentState } from "#/hooks/use-agent-state";
import { useRespondToConfirmation } from "#/hooks/mutation/use-respond-to-confirmation";
import { SecurityRisk } from "#/types/v1/core/base/common";
import { getEventContent } from "#/components/v1/chat/event-content-helpers/get-event-content";

export function V1ConfirmationButtons() {
  const v1SubmittedEventIds = useEventMessageStore(
    (state) => state.v1SubmittedEventIds,
  );
  const addV1SubmittedEventId = useEventMessageStore(
    (state) => state.addV1SubmittedEventId,
  );

  const { t } = useTranslation();
  const { data: conversation } = useActiveConversation();
  // In plan mode the pending action belongs to the planning sub-conversation
  // (its own sandbox). Answering on the parent instead left the planner stuck
  // and made the parent's code agent run the task unasked (phone test 2026-09-21).
  const { data: subConversations } = useSubConversations(
    conversation?.sub_conversation_ids,
  );
  const { curAgentState } = useAgentState();
  const { mutate: respondToConfirmation } = useRespondToConfirmation();
  const events = useEventStore((state) => state.events);

  // Find the most recent V1 action awaiting confirmation. It must be the last
  // *action* (not just the last agent event): the agent usually streams a
  // thought before the tool call, and in plan mode the pending file edit is not
  // even shown in the thread, so this panel names the action itself.
  const awaitingAction =
    curAgentState === AgentState.AWAITING_USER_CONFIRMATION
      ? events
          .filter(isV1Event)
          .slice()
          .reverse()
          .find((ev) => ev.source === "agent" && isActionEvent(ev))
      : undefined;

  // On a phone the thread often does not auto-scroll far enough and the panel
  // sits under the composer; bring it into view whenever a new action arrives.
  const panelRef = useRef<HTMLDivElement>(null);
  const awaitingId = awaitingAction?.id;
  useEffect(() => {
    if (awaitingId) {
      panelRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    }
  }, [awaitingId]);

  const handleConfirmation = useCallback(
    (accept: boolean) => {
      if (!awaitingAction || !conversation) {
        return;
      }

      // Mark event as submitted to prevent duplicate submissions
      addV1SubmittedEventId(awaitingAction.id);

      const fromPlanner = (awaitingAction as { isFromPlanningAgent?: boolean })
        .isFromPlanningAgent;
      const target =
        fromPlanner && subConversations?.[0]
          ? subConversations[0]
          : conversation;

      // Call the V1 API endpoint
      respondToConfirmation({
        conversationId: target.id,
        conversationUrl: target.conversation_url || "",
        sessionApiKey: target.session_api_key,
        accept,
      });
    },
    [
      awaitingAction,
      conversation,
      subConversations,
      addV1SubmittedEventId,
      respondToConfirmation,
    ],
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!awaitingAction) {
      return undefined;
    }

    const handleCancelShortcut = (event: KeyboardEvent) => {
      if (event.shiftKey && event.metaKey && event.key === "Backspace") {
        event.preventDefault();
        handleConfirmation(false);
      }
    };

    const handleContinueShortcut = (event: KeyboardEvent) => {
      if (event.metaKey && event.key === "Enter") {
        event.preventDefault();
        handleConfirmation(true);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Cancel: Shift+Cmd+Backspace (⇧⌘⌫)
      handleCancelShortcut(event);
      // Continue: Cmd+Enter (⌘↩)
      handleContinueShortcut(event);
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [awaitingAction, handleConfirmation]);

  if (
    curAgentState !== AgentState.AWAITING_USER_CONFIRMATION ||
    !awaitingAction
  ) {
    return null;
  }

  // Already answered, agent has not moved on yet: say so, or a phone user
  // cannot tell a slow model from a tap that did not register.
  if (v1SubmittedEventIds.includes(awaitingAction.id)) {
    return (
      <p
        className="pt-4 text-sm text-neutral-400"
        data-testid="v1-confirmation-sent"
      >
        {t(I18nKey.CHAT_INTERFACE$USER_CONFIRMED)} …
      </p>
    );
  }

  // Get security risk from the action (only ActionEvent has security_risk)
  const risk = isActionEvent(awaitingAction)
    ? awaitingAction.security_risk
    : SecurityRisk.UNKNOWN;

  const isHighRisk = risk === SecurityRisk.HIGH;

  const pendingTitle = isActionEvent(awaitingAction)
    ? getEventContent(awaitingAction).title
    : null;

  return (
    <div
      className="flex flex-col gap-2 pt-4 scroll-mb-40"
      data-testid="v1-confirmation-panel"
    >
      {isHighRisk && (
        <RiskAlert
          content={t(I18nKey.CHAT_INTERFACE$HIGH_RISK_WARNING)}
          icon={<WarningIcon width={16} height={16} color="#fff" />}
          severity="high"
          title={t(I18nKey.COMMON$HIGH_RISK)}
        />
      )}
      <div className="flex flex-wrap justify-between items-center gap-3 rounded-lg border border-neutral-600 bg-neutral-800/60 px-3 py-2">
        <div className="flex flex-col gap-1 min-w-0">
          {pendingTitle && (
            <p className="text-sm font-bold text-neutral-300 break-words">
              {pendingTitle}
            </p>
          )}
          <p className="text-sm font-normal text-white">
            {t(I18nKey.CHAT_INTERFACE$USER_ASK_CONFIRMATION)}
          </p>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <ActionTooltip
            type="reject"
            onClick={() => handleConfirmation(false)}
          />
          <ActionTooltip
            type="confirm"
            onClick={() => handleConfirmation(true)}
          />
        </div>
      </div>
    </div>
  );
}
