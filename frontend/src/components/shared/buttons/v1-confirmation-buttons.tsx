import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import { AgentState } from "#/types/agent-state";
import { ActionTooltip } from "../action-tooltip";
import { RiskAlert } from "#/components/shared/risk-alert";
import { WorkspacePath } from "#/components/shared/workspace-path";
import WarningIcon from "#/icons/u-warning.svg?react";
import { useEventMessageStore } from "#/stores/event-message-store";
import { useEventStore } from "#/stores/use-event-store";
import { usePolicyStore } from "#/stores/policy-store";
import { isV1Event, isActionEvent } from "#/types/v1/type-guards";
import type { ActionEvent, OpenHandsEvent } from "#/types/v1/core";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useSubConversations } from "#/hooks/query/use-sub-conversations";
import { useAgentState } from "#/hooks/use-agent-state";
import { useRespondToConfirmation } from "#/hooks/mutation/use-respond-to-confirmation";
import { useGrantSessionAllow } from "#/hooks/mutation/use-grant-session-allow";
import { SecurityRisk } from "#/types/v1/core/base/common";
import { getEventContent } from "#/components/v1/chat/event-content-helpers/get-event-content";
import { classify, defaultPolicyConfig } from "#/utils/llmkit-policy";
import { fingerprintAction } from "#/utils/action-summary";
import { describeGrant } from "#/utils/describe-grant";
import { displayErrorToast } from "#/utils/custom-toast-handlers";
import { cn } from "#/utils/utils";

const MAX_LISTED = 6;

type PlannerTagged = OpenHandsEvent & { isFromPlanningAgent?: boolean };

/** An observation (or the user's rejection) that answers the given action. */
const answers = (event: OpenHandsEvent, action: ActionEvent) =>
  event.source === "environment" &&
  "action_id" in event &&
  (event as { action_id?: string }).action_id === action.id;

/**
 * The confirmation panel: every action the agent is waiting on, what each one
 * would do and where, the risk the kit's policy assigns, and one Continue /
 * Cancel / Allow-for-session for the whole batch. The sandbox already lets
 * read-only and allow-listed actions through (llmkit_policy); what reaches
 * this panel is a write, an unknown command, or something outside the workspace.
 */
export function V1ConfirmationButtons() {
  const v1SubmittedEventIds = useEventMessageStore(
    (state) => state.v1SubmittedEventIds,
  );
  const addV1SubmittedEventId = useEventMessageStore(
    (state) => state.addV1SubmittedEventId,
  );
  const removeV1SubmittedEventId = useEventMessageStore(
    (state) => state.removeV1SubmittedEventId,
  );
  const acceptedFingerprints = useEventMessageStore(
    (state) => state.acceptedFingerprints,
  );
  const addAcceptedFingerprints = useEventMessageStore(
    (state) => state.addAcceptedFingerprints,
  );

  const { t } = useTranslation();
  const { data: conversation } = useActiveConversation();
  // In plan mode the pending action belongs to the planning sub-conversation.
  // Answering on the parent instead left the planner stuck and made the
  // parent's code agent run the task unasked (phone test 2026-09-21).
  const { data: subConversations } = useSubConversations(
    conversation?.sub_conversation_ids,
  );
  const { curAgentState } = useAgentState();
  const { mutate: respondToConfirmation } = useRespondToConfirmation();
  const { mutate: grantSessionAllow, isPending: isGranting } =
    useGrantSessionAllow();
  const events = useEventStore((state) => state.events);
  const awaiting = curAgentState === AgentState.AWAITING_USER_CONFIRMATION;

  // The last agent action names the batch: the SDK asks once per LLM response,
  // so every unanswered action with the same llm_response_id is pending too.
  const v1Events = useMemo(() => events.filter(isV1Event), [events]);
  const lastAction = useMemo(
    () =>
      awaiting
        ? (v1Events
            .slice()
            .reverse()
            .find((ev) => ev.source === "agent" && isActionEvent(ev)) as
            | ActionEvent
            | undefined)
        : undefined,
    [awaiting, v1Events],
  );
  const pending = useMemo<ActionEvent[]>(() => {
    if (!lastAction) return [];
    return v1Events.filter(
      (ev): ev is ActionEvent =>
        ev.source === "agent" &&
        isActionEvent(ev) &&
        ev.llm_response_id === lastAction.llm_response_id &&
        !v1Events.some((other) => answers(other, ev)),
    );
  }, [lastAction, v1Events]);

  const fromPlanner = (lastAction as PlannerTagged | undefined)
    ?.isFromPlanningAgent;
  const target =
    fromPlanner && subConversations?.[0] ? subConversations[0] : conversation;
  const grants = usePolicyStore((state) =>
    target ? state.byConversation[target.id]?.grants : undefined,
  );
  const decisions = useMemo(() => {
    const cfg = defaultPolicyConfig({ grants: grants ?? [] });
    return pending.map((ev) => ({
      event: ev,
      decision: classify(
        { tool_name: ev.tool_name, action: ev.action as never },
        cfg,
      ),
      title: getEventContent(ev).title,
      path: (ev.action as { path?: string }).path,
      command: (ev.action as { command?: string; kind?: string }).kind?.match(
        /^(Terminal|ExecuteBash)Action$/,
      )
        ? (ev.action as { command?: string }).command
        : undefined,
    }));
  }, [pending, grants]);

  const anyDeny = decisions.some((d) => d.decision.verdict === "deny");
  const anyHigh = pending.some((ev) => ev.security_risk === SecurityRisk.HIGH);
  const risk: "high" | "medium" = anyDeny || anyHigh ? "high" : "medium";
  const suggested = useMemo(
    () =>
      Array.from(
        new Set(
          decisions
            .filter((d) => d.decision.verdict === "ask")
            .flatMap((d) => d.decision.suggestedGrants.slice(0, 1)),
        ),
      ),
    [decisions],
  );
  const fingerprints = useMemo(() => pending.map(fingerprintAction), [pending]);
  // The sandbox asks about a read-only action once it is the third identical one in
  // a row (it is looping); count the same run here so the panel can say so.
  const repeatCounts = useMemo(() => {
    const recent = v1Events
      .filter(
        (ev): ev is ActionEvent => ev.source === "agent" && isActionEvent(ev),
      )
      .slice(-12)
      .map(fingerprintAction);
    return fingerprints.map((fp) => {
      let n = 0;
      for (let i = recent.length - 1; i >= 0 && recent[i] === fp; i -= 1)
        n += 1;
      return n;
    });
  }, [v1Events, fingerprints]);
  const allSeenBefore =
    pending.length > 0 &&
    fingerprints.every((fp) => acceptedFingerprints.includes(fp));

  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState<{
    accept: boolean;
    reason?: string;
    auto?: boolean;
  } | null>(null);

  // On a phone the thread often does not auto-scroll far enough and the panel
  // sits under the composer; bring it into view whenever a new batch arrives.
  const panelRef = useRef<HTMLDivElement>(null);
  const awaitingId = lastAction?.id;
  useEffect(() => {
    if (awaitingId) {
      panelRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
      setShowReason(false);
      setReason("");
      setSent(null);
    }
  }, [awaitingId]);

  const handleConfirmation = useCallback(
    (accept: boolean, why?: string, auto = false) => {
      if (!lastAction || !target) return;
      // Mark the batch as answered to prevent duplicate submissions
      addV1SubmittedEventId(lastAction.id);
      if (accept) addAcceptedFingerprints(fingerprints);
      setSent({ accept, reason: why, auto });
      respondToConfirmation({
        conversationId: target.id,
        conversationUrl: target.conversation_url || "",
        sessionApiKey: target.session_api_key,
        accept,
        reason: why,
      });
    },
    [
      lastAction,
      target,
      fingerprints,
      addV1SubmittedEventId,
      addAcceptedFingerprints,
      respondToConfirmation,
    ],
  );

  const handleAllow = useCallback(() => {
    if (!target || suggested.length === 0) return;
    grantSessionAllow(
      {
        conversationId: target.id,
        conversationUrl: target.conversation_url || "",
        sessionApiKey: target.session_api_key,
        grants: suggested,
      },
      {
        onSuccess: () => handleConfirmation(true),
        onError: (error) => displayErrorToast(error.message),
      },
    );
  }, [target, suggested, grantSessionAllow, handleConfirmation]);

  // Never ask twice for the same thing: a batch identical to one approved this
  // session is approved again, and the panel says so.
  const submitted = lastAction
    ? v1SubmittedEventIds.includes(lastAction.id)
    : false;
  useEffect(() => {
    if (awaiting && lastAction && allSeenBefore && !submitted && !anyDeny) {
      handleConfirmation(true, undefined, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingId, allSeenBefore, submitted, anyDeny]);

  // An answer the sandbox took flips its status within a second. One that raced the
  // state update (the sandbox was still running the previous action) is a no-op there,
  // and the panel would show "confirmed" for ever: after 8 s still waiting, ask again.
  useEffect(() => {
    if (!awaiting || !lastAction || !submitted) return undefined;
    const { id } = lastAction;
    const timer = window.setTimeout(() => removeV1SubmittedEventId(id), 8000);
    return () => window.clearTimeout(timer);
  }, [awaiting, lastAction, submitted, removeV1SubmittedEventId]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!lastAction || submitted) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.shiftKey && event.metaKey && event.key === "Backspace") {
        event.preventDefault();
        handleConfirmation(false);
      } else if (event.metaKey && event.key === "Enter") {
        event.preventDefault();
        handleConfirmation(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [lastAction, submitted, handleConfirmation]);

  if (!awaiting || !lastAction) {
    return null;
  }

  // Already answered, agent has not moved on yet: say so, or a phone user
  // cannot tell a slow model from a tap that did not register.
  if (submitted) {
    let cue = `${t(I18nKey.CHAT_INTERFACE$USER_CONFIRMED)} …`;
    if (sent?.auto) cue = t(I18nKey.CHAT_INTERFACE$AUTO_APPROVED_SAME);
    else if (sent && !sent.accept)
      cue = `${t(I18nKey.CHAT_INTERFACE$USER_REJECTED)}${sent.reason ? `: ${sent.reason}` : ""}`;
    return (
      <p
        className="pt-4 text-sm text-neutral-400"
        data-testid="v1-confirmation-sent"
      >
        {cue}
      </p>
    );
  }

  const kinds = Array.from(
    new Set(pending.map((ev) => (ev.action as { kind?: string }).kind ?? "")),
  ).join(",");

  return (
    <div
      ref={panelRef}
      className="flex flex-col gap-2 px-4"
      data-testid="v1-confirmation-panel"
      data-count={pending.length}
      data-kind={kinds}
      data-risk={risk}
    >
      {risk === "high" && (
        <RiskAlert
          content={
            anyDeny
              ? t(I18nKey.POLICY$DENY_HINT)
              : t(I18nKey.CHAT_INTERFACE$HIGH_RISK_WARNING)
          }
          icon={<WarningIcon width={16} height={16} color="#fff" />}
          severity="high"
          title={t(I18nKey.COMMON$HIGH_RISK)}
        />
      )}
      <div
        className={cn(
          "flex flex-col gap-2 rounded-lg border bg-neutral-800/60 px-3 py-2",
          risk === "high" ? "border-red-700" : "border-amber-600/70",
        )}
      >
        <ul
          className="flex flex-col gap-1.5 min-w-0"
          data-testid="v1-pending-actions"
        >
          {decisions.slice(0, MAX_LISTED).map((d, i) => (
            <li key={d.event.id} className="text-sm min-w-0">
              <span className="font-bold text-neutral-200 break-words">
                {d.title}
              </span>
              {repeatCounts[i] >= 3 && (
                <span className="text-amber-400" data-testid="v1-repeat-note">
                  {" "}
                  {t(I18nKey.CHAT_INTERFACE$REPEATING, {
                    count: repeatCounts[i],
                  })}
                </span>
              )}
              {d.path && (
                <div className="text-xs">
                  <WorkspacePath path={d.path} />
                </div>
              )}
              {d.decision.verdict === "deny" && (
                <div className="text-xs text-red-400">{d.decision.reason}</div>
              )}
            </li>
          ))}
          {decisions.length > MAX_LISTED && (
            <li className="text-xs text-neutral-400">
              +{decisions.length - MAX_LISTED}
            </li>
          )}
        </ul>
        <p className="text-sm font-normal text-white">
          {pending.length > 1
            ? t(I18nKey.CHAT_INTERFACE$PENDING_ACTIONS, {
                count: pending.length,
              })
            : t(I18nKey.CHAT_INTERFACE$USER_ASK_CONFIRMATION)}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ActionTooltip
            type="reject"
            onClick={() => handleConfirmation(false)}
          />
          {suggested.length > 0 && !anyDeny && (
            <button
              type="button"
              data-testid="action-allow-session-button"
              disabled={isGranting}
              onClick={handleAllow}
              className="rounded px-3 min-h-9 text-sm font-medium leading-5 cursor-pointer border border-neutral-400 text-white hover:opacity-80 disabled:opacity-50"
            >
              {t(I18nKey.CHAT_INTERFACE$ALLOW_FOR_SESSION)}
            </button>
          )}
          <ActionTooltip
            type="confirm"
            onClick={() => handleConfirmation(true)}
          />
        </div>
        {suggested.length > 0 && !anyDeny && (
          <p
            className="text-xs text-neutral-400 text-right"
            data-testid="v1-allow-hint"
          >
            {t(I18nKey.CHAT_INTERFACE$ALLOW_HINT, {
              what: suggested.map((g) => describeGrant(g, t)).join(", "),
            })}
          </p>
        )}
        {!showReason ? (
          <button
            type="button"
            data-testid="action-reject-reason-button"
            onClick={() => setShowReason(true)}
            className="self-start text-xs text-neutral-400 underline cursor-pointer"
          >
            {t(I18nKey.CHAT_INTERFACE$REJECT_WITH_REASON)}
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              data-testid="action-reject-reason-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t(I18nKey.CHAT_INTERFACE$REASON_PLACEHOLDER)}
              className="flex-1 min-w-0 rounded bg-neutral-900 border border-neutral-600 px-2 py-1.5 text-sm text-white"
            />
            <button
              type="button"
              data-testid="action-reject-with-reason-button"
              onClick={() =>
                handleConfirmation(false, reason.trim() || undefined)
              }
              className="rounded px-3 min-h-9 text-sm font-medium bg-white text-[#0D0F11] cursor-pointer"
            >
              {t(I18nKey.CHAT_INTERFACE$SEND_REJECTION)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
