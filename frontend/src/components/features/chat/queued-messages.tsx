import { useParams } from "react-router";
import { useQueuedMessageStore } from "#/stores/queued-message-store";

/* eslint-disable i18next/no-literal-string */
/**
 * Fork: messages waiting for their agent's socket (queued-message-store), so a message
 * typed while the planner starts or the connection is down is visibly on its way,
 * not silently gone. Each can be withdrawn before it is sent.
 */
export function QueuedMessages() {
  const { conversationId } = useParams();
  const items = useQueuedMessageStore((s) => s.items).filter(
    (i) => i.conversationId === conversationId,
  );
  const remove = useQueuedMessageStore((s) => s.remove);
  if (items.length === 0) return null;
  return (
    <div data-testid="queued-messages" className="flex flex-col gap-1 mb-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-neutral-600 text-xs text-neutral-300"
        >
          <span className="shrink-0 text-neutral-400">
            {item.target === "plan"
              ? "For the planner, when it is up:"
              : "Sends when connected:"}
          </span>
          <span className="min-w-0 truncate">{item.text}</span>
          <button
            type="button"
            aria-label="Withdraw this message"
            onClick={() => remove(item.id)}
            className="ml-auto shrink-0 min-w-8 min-h-8 text-neutral-400 hover:text-white"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
