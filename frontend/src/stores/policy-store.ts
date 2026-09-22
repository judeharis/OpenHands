import { create } from "zustand";

/**
 * What the sandbox's security analyzer currently is, per conversation id, as
 * last read or written by this client. The sandbox decides for real; this is
 * what the confirmation panel uses to colour actions and suggest grants.
 */
export interface PolicyEntry {
  kind: string | null;
  grants: string[];
}

interface PolicyStore {
  byConversation: Record<string, PolicyEntry>;
  setPolicy: (conversationId: string, entry: PolicyEntry) => void;
}

export const usePolicyStore = create<PolicyStore>((set) => ({
  byConversation: {},
  setPolicy: (conversationId, entry) =>
    set((state) => ({
      byConversation: { ...state.byConversation, [conversationId]: entry },
    })),
}));
