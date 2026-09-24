import { create } from "zustand";

/**
 * Fork: a first message typed on the home screen with files attached. Images can ride in
 * the create request, but a file has to be uploaded into the sandbox, which does not
 * exist until the conversation has started. So such a conversation is created empty, and
 * the message waits here -- held by the start task's id, then by the conversation's once
 * the task resolves -- until the chat can send it the way it sends any other message.
 *
 * A home-screen Plan waits here too, with or without files: it starts a code conversation,
 * and its first message goes to a planner inside it (mode "plan", see use-start-planner).
 *
 * In memory only: File objects do not survive a reload, and a reload before the sandbox
 * is up leaves the conversation empty, as if "Start an empty conversation" had been used.
 */
export interface PendingFirstMessage {
  taskId: string;
  conversationId: string | null;
  text: string;
  images: File[];
  files: File[];
  /** "plan": send it to a planner inside the conversation, not to the code agent. */
  mode?: "plan";
}

interface PendingFirstMessageStore {
  pending: PendingFirstMessage | null;
  hold: (pending: Omit<PendingFirstMessage, "conversationId">) => void;
  /** The start task became this conversation. */
  resolve: (taskId: string, conversationId: string) => void;
  /** Hand the message over, once, to the chat of `conversationId`. */
  take: (conversationId: string) => PendingFirstMessage | null;
}

export const usePendingFirstMessageStore = create<PendingFirstMessageStore>(
  (set, get) => ({
    pending: null,
    hold: (pending) => set({ pending: { ...pending, conversationId: null } }),
    resolve: (taskId, conversationId) => {
      const { pending } = get();
      if (pending?.taskId === taskId)
        set({ pending: { ...pending, conversationId } });
    },
    take: (conversationId) => {
      const { pending } = get();
      if (!pending || pending.conversationId !== conversationId) return null;
      set({ pending: null });
      return pending;
    },
  }),
);
