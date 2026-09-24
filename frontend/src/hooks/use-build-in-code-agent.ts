import { useCallback, useContext } from "react";
import { UNSAFE_NavigationContext } from "react-router";
import { useCreateConversation } from "#/hooks/mutation/use-create-conversation";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useConversationAgentType } from "#/hooks/query/use-conversation-agent-type";
import { useConversationStore } from "#/stores/conversation-store";
import V1ConversationService from "#/api/conversation-service/v1-conversation-service.api";
import { useEventStore } from "#/stores/use-event-store";
import { isMessageEvent } from "#/types/v1/type-guards";
import type { OpenHandsEvent } from "#/types/v1/core";
import { BUILD_PREAMBLE } from "#/utils/build-step";

export { BUILD_PREAMBLE };

const MAX_PLAN_CHARS = 12_000;

const replyText = (e: OpenHandsEvent): string =>
  isMessageEvent(e) && e.llm_message.role === "assistant"
    ? (e.llm_message.content as { type: string; text?: string }[])
        .map((c) => (c.type === "text" ? (c.text ?? "") : ""))
        .join("\n")
        .trim()
    : "";

/**
 * The plan, when PLAN.md was never written: the planner's LONGEST reply, not its last. The last
 * one is usually the hand-off note ("click the Build button below the plan preview"), and a code
 * agent given that as its plan went looking for a Build button with its browser (2026-09-23).
 */
export function planFromReplies(events: unknown[]): string {
  let best = "";
  for (const e of events as OpenHandsEvent[]) {
    const t = replyText(e);
    if (t.length > best.length) best = t;
  }
  return best;
}


/**
 * The Build step inside one conversation: the planner was a sub-conversation, so the code agent
 * here never saw its replies, and gets the plan the same way a separate one would.
 */
export function buildStepMessage(planWritten: boolean, plannerText: string): string {
  if (planWritten) return `${BUILD_PREAMBLE}\n\nExecute the plan in .agents_tmp/PLAN.md, which the planning agent wrote.`;
  const plan = plannerText.length > MAX_PLAN_CHARS ? `${plannerText.slice(0, MAX_PLAN_CHARS)}\n…(truncated)` : plannerText;
  return `${BUILD_PREAMBLE}\n\nExecute this plan from the planning agent (its PLAN.md was not written):\n\n${plan}`;
}

/** The first message of the code agent a planner hands over to. */
export function buildMessage(plannerId: string, planWritten: boolean, plannerText: string): string {
  if (planWritten) {
    return `${BUILD_PREAMBLE}\n\nExecute the plan in .agents_tmp/PLAN.md (written by planning conversation ${plannerId}).`;
  }
  const plan = plannerText.length > MAX_PLAN_CHARS ? `${plannerText.slice(0, MAX_PLAN_CHARS)}\n…(truncated)` : plannerText;
  return `${BUILD_PREAMBLE}\n\nExecute this plan from planning conversation ${plannerId} (its PLAN.md was not written):\n\n${plan}`;
}

/**
 * Build for a conversation that was started as a planner. Its main agent has no terminal and
 * no code agent behind it, so the stock Build (switch to code mode, send "Execute the plan")
 * would send the order to the planner itself. Instead: start a code conversation in the SAME
 * sandbox -- same workspace, so .agents_tmp/PLAN.md is there -- with the plan as its first
 * message, and open it.
 */
export const useBuildInCodeAgent = () => {
  // The Code/Plan chip and the plan preview that call this are also rendered outside a
  // router (their unit tests); useNavigate() would throw there, the context is just null.
  const navigator = useContext(UNSAFE_NavigationContext)?.navigator;
  const { data: conversation } = useActiveConversation();
  const { data: agentType } = useConversationAgentType(conversation?.id);
  const { planContent } = useConversationStore();
  const { mutate: createConversation, isPending } = useCreateConversation();

  const isPlanConversation = agentType === "plan";

  const buildInCodeAgent = useCallback(async () => {
    if (!conversation) return;
    // Ask the sandbox whether PLAN.md exists: planContent is only set once the plan preview
    // has rendered, and a conversation opened fresh on the phone has not rendered it yet.
    let planWritten = !!planContent;
    if (!planWritten) {
      try {
        planWritten = !!(await V1ConversationService.readConversationFile(conversation.id)).trim();
      } catch {
        planWritten = false;
      }
    }
    const events = useEventStore.getState().events as unknown[];
    const query = buildMessage(conversation.id, planWritten, planFromReplies(events));
    createConversation(
      { query, agentType: "default", sandboxId: conversation.sandbox_id },
      {
        onSuccess: (data) => {
          const to = `/conversations/${data.conversation_id}`;
          if (navigator) navigator.push(to);
          else window.location.assign(to);
        },
      },
    );
  }, [conversation, planContent, createConversation, navigator]);

  return { isPlanConversation, buildInCodeAgent, isPending };
};
