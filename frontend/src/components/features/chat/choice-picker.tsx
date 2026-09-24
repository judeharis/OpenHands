import React from "react";
import { useAgentState } from "#/hooks/use-agent-state";
import { useSendMessage } from "#/hooks/use-send-message";
import { createChatMessage } from "#/services/chat-service";
import { useOptimisticUserMessageStore } from "#/stores/optimistic-user-message-store";
import { useEventStore } from "#/stores/use-event-store";
import { AgentState } from "#/types/agent-state";
import { isLatestReply as isLatest } from "#/utils/latest-reply";
import { cn } from "#/utils/utils";
import { ChoiceQuestion, formatAnswer } from "#/utils/parse-choices";

const OTHER = "\u0000other";

/* eslint-disable i18next/no-literal-string */
/**
 * The agent's ```choices block as a picker, like the question dialog in Claude: tap an option
 * (or several, when multiSelect), or write your own under "Other", and the answer goes back as
 * your reply. Read-only once answered, or when a newer message has come since.
 */
export function ChoicePicker({ questions, raw }: { questions: ChoiceQuestion[]; raw: string }) {
  const { curAgentState } = useAgentState();
  const { send } = useSendMessage();
  const { setOptimisticUserMessage } = useOptimisticUserMessageStore();
  const events = useEventStore((s) => s.events);
  const [picks, setPicks] = React.useState<string[][]>(() => questions.map(() => []));
  const [other, setOther] = React.useState<string[]>(() => questions.map(() => ""));
  const [sent, setSent] = React.useState(false);
  const [note, setNote] = React.useState("");

  const busy = curAgentState === AgentState.RUNNING || curAgentState === AgentState.LOADING;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const latest = React.useMemo(() => isLatest(raw), [events.length, raw]);
  const live = latest && !sent && !busy;

  const answerFor = (i: number) =>
    picks[i].map((p) => (p === OTHER ? other[i].trim() : p)).filter(Boolean);
  const complete = questions.every((_, i) => answerFor(i).length > 0);

  const submit = (override?: string[][]) => {
    const answers = override ?? questions.map((_, i) => answerFor(i));
    const text = formatAnswer(questions, answers) + (note.trim() ? `\n\n${note.trim()}` : "");
    send(createChatMessage(text, [], [], new Date().toISOString()));
    setOptimisticUserMessage(text);
    setSent(true);
  };

  const toggle = (qi: number, label: string) => {
    const q = questions[qi];
    const cur = picks[qi];
    const next = q.multiSelect
      ? cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label]
      : [label];
    const all = picks.map((p, i) => (i === qi ? next : p));
    setPicks(all);
    // One single-choice question is answered by the tap itself, as in Claude.
    if (questions.length === 1 && !q.multiSelect && label !== OTHER) submit([[label]]);
  };

  return (
    <div data-testid="choice-picker" className="flex flex-col gap-4 my-2 w-full">
      {questions.map((q, qi) => (
        <fieldset key={q.question} className="flex flex-col gap-2 min-w-0">
          <legend className="text-sm font-medium text-white mb-1">
            {q.question}
            {q.multiSelect && <span className="text-neutral-400 font-normal"> (pick any)</span>}
          </legend>
          {[...q.options, { label: OTHER }].map((o) => {
            const isOther = o.label === OTHER;
            const on = picks[qi].includes(o.label);
            return (
              <button
                key={o.label}
                type="button"
                disabled={!live}
                aria-pressed={on}
                data-testid={isOther ? "choice-other" : "choice-option"}
                onClick={() => toggle(qi, o.label)}
                className={cn(
                  "flex flex-col items-start text-left gap-0.5 min-h-11 px-3 py-2 rounded-lg border transition-colors",
                  on ? "border-[#597FF4] bg-[#4A67BD]/40" : "border-[#4B505F] bg-[#25272d]",
                  live ? "cursor-pointer hover:border-[#597FF4]" : "opacity-60 cursor-default",
                )}
              >
                <span className="text-sm text-white">{isOther ? "Other…" : o.label}</span>
                {"description" in o && o.description && (
                  <span className="text-xs text-neutral-400">{o.description}</span>
                )}
              </button>
            );
          })}
          {picks[qi].includes(OTHER) && live && (
            <textarea
              data-testid="choice-other-text"
              value={other[qi]}
              onChange={(e) => setOther(other.map((v, i) => (i === qi ? e.target.value : v)))}
              placeholder="Your answer"
              rows={2}
              className="w-full rounded-lg border border-[#4B505F] bg-[#1b1d22] p-2 text-sm text-white"
            />
          )}
        </fieldset>
      ))}
      {live && (questions.length > 1 || questions[0].multiSelect || picks[0].includes(OTHER)) && (
        <textarea
          data-testid="choice-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything else? (optional: answers to other questions, constraints)"
          rows={2}
          className="w-full rounded-lg border border-[#4B505F] bg-[#1b1d22] p-2 text-sm text-white"
        />
      )}
      {live && (questions.length > 1 || questions[0].multiSelect || picks[0].includes(OTHER)) && (
        <button
          type="button"
          data-testid="choice-send"
          disabled={!complete}
          onClick={() => submit()}
          className={cn(
            "self-start min-h-11 px-4 rounded-lg bg-white text-black text-sm font-medium",
            complete ? "cursor-pointer hover:opacity-90" : "opacity-50 cursor-not-allowed",
          )}
        >
          Send answer
        </button>
      )}
      {sent && <span className="text-xs text-neutral-400">Answer sent.</span>}
    </div>
  );
}
