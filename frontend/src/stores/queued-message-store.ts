import { create } from "zustand";
import type { V1SendMessageRequest } from "#/api/conversation-service/v1-conversation-service.types";

/**
 * Fork: messages typed while the agent they are for cannot take them yet -- its socket is
 * connecting or reconnecting, or the planner is still starting. They used to go to the app
 * server's pending-message queue, which is emptied only while a conversation starts, so a
 * message sent to a running conversation with its socket down was never delivered, and one
 * typed in plan mode before the planner was up went to the code agent instead. They now wait
 * here, are shown above the composer, and are sent in order once that socket is open.
 * In memory only: a reload drops them (they are listed, so the user can see that).
 */
export interface QueuedMessage {
  id: string;
  conversationId: string;
  target: "main" | "plan";
  message: V1SendMessageRequest;
  text: string;
}

interface QueuedMessageStore {
  items: QueuedMessage[];
  add: (item: Omit<QueuedMessage, "id">) => void;
  remove: (id: string) => void;
}

let seq = 0;

export const useQueuedMessageStore = create<QueuedMessageStore>((set) => ({
  items: [],
  add: (item) => {
    seq += 1;
    const id = `q${seq}`;
    set((s) => ({ items: [...s.items, { ...item, id }] }));
  },
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

export const messageText = (message: V1SendMessageRequest): string =>
  message.content
    .map((c) => ("text" in c && typeof c.text === "string" ? c.text : ""))
    .join(" ")
    .trim();
