import React from "react";
import { useAgentState } from "#/hooks/use-agent-state";
import { useBuildInCodeAgent } from "#/hooks/use-build-in-code-agent";
import { useHandleBuildPlanClick } from "#/hooks/use-handle-build-plan-click";
import { useEventStore } from "#/stores/use-event-store";
import { AgentState } from "#/types/agent-state";
import { isLatestReply } from "#/utils/latest-reply";
import CodeTagIcon from "#/icons/code-tag.svg?react";

/* eslint-disable i18next/no-literal-string */
/**
 * Build, inside the planner's own newest reply. The planner's instruction tells the user to
 * "click the Build button below the plan preview", but that preview only exists once PLAN.md
 * was written and rendered in this page -- on a phone, after a reload, or when the write
 * failed, there was nothing to click and the user replied "yes build it" to an agent that
 * cannot build. The button now sits under the text that asks for it, and runs the same Build
 * (the code agent of this conversation; a new one in this sandbox for an old top-level planner).
 */
export function PlanReplyBuildButton({ raw, isFromPlanningAgent }: { raw: string; isFromPlanningAgent: boolean }) {
  const { isPlanConversation, isPending } = useBuildInCodeAgent();
  const { handleBuildPlanClick } = useHandleBuildPlanClick();
  const { curAgentState } = useAgentState();
  const events = useEventStore((s) => s.events);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const latest = React.useMemo(() => isLatestReply(raw), [events.length, raw]);
  const [clicked, setClicked] = React.useState(false);

  const busy = curAgentState === AgentState.RUNNING || curAgentState === AgentState.LOADING;
  if (!(isFromPlanningAgent || isPlanConversation) || !latest || busy) return null;

  return (
    <div className="flex items-center gap-3 mt-3">
      <button
        type="button"
        data-testid="plan-reply-build-button"
        disabled={clicked || isPending}
        onClick={() => {
          setClicked(true);
          handleBuildPlanClick();
        }}
        className="flex items-center gap-1.5 min-h-11 px-4 rounded-lg bg-white text-black text-sm font-medium cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-wait"
      >
        <CodeTagIcon width={18} height={18} color="#000000" />
        {clicked ? "Building…" : "Build"}
      </button>
    </div>
  );
}
