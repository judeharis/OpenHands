import { ActionEvent } from "#/types/v1/core";
import { FinishAction } from "#/types/v1/core/base/action";
import { ChatMessage } from "../../../features/chat/chat-message";
import { getEventContent } from "../event-content-helpers/get-event-content";
import { CriticResultDisplay } from "./critic-result-display";
import { ChoicePicker } from "../../../features/chat/choice-picker";
import { PlanReplyBuildButton } from "../../../features/chat/plan-reply-build-button";
import { inferChoices } from "#/utils/parse-choices";

interface FinishEventMessageProps {
  event: ActionEvent<FinishAction>;
  isFromPlanningAgent?: boolean;
}

export function FinishEventMessage({
  event,
  isFromPlanningAgent = false,
}: FinishEventMessageProps) {
  const eventContent = getEventContent(event);
  const message =
    typeof eventContent.details === "string"
      ? eventContent.details
      : String(eventContent.details);
  const raw = typeof event.action.message === "string" ? event.action.message : "";
  const inferred = raw ? inferChoices(raw) : null;

  return (
    <>
      <ChatMessage
        type="agent"
        message={message}
        isFromPlanningAgent={isFromPlanningAgent}
      >
        {inferred && <ChoicePicker questions={inferred} raw={raw} />}
        {!!raw && raw && (
          <PlanReplyBuildButton raw={raw} isFromPlanningAgent={isFromPlanningAgent} />
        )}
      </ChatMessage>
      {event.critic_result != null && (
        <CriticResultDisplay criticResult={event.critic_result} />
      )}
    </>
  );
}
