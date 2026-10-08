import { useQuery } from "@tanstack/react-query";

export type JenticMode = "chat" | "agent";

/**
 * jentic-x: each conversation is Chat (no tools, a short system prompt, the user's own
 * instructions) or Agent (terminal and file editor). The app says whether this deployment
 * has modes (JENTIC_MODES=1 in jentic.env); bruny's jentic answers false, or nothing.
 */
export function useJenticModes(): boolean {
  const { data } = useQuery({
    queryKey: ["jentic-modes"],
    queryFn: async () => {
      try {
        const r = await fetch("/api/v1/llmkit/features", {
          credentials: "same-origin",
        });
        if (!r.ok) return false;
        const d = await r.json();
        return d?.modes === true;
      } catch {
        return false;
      }
    },
    staleTime: Infinity,
    retry: false,
  });
  return data === true;
}

/** The marker the app reads at the start of system_message_suffix (llmkit_policy/modes.py). */
export function modeSuffix(mode: JenticMode, extraPrompt?: string): string {
  const extra = mode === "chat" ? (extraPrompt ?? "").trim() : "";
  return `<jentic-mode>${mode}</jentic-mode>${extra ? `\n${extra}` : ""}`;
}

/** The mode a conversation was started in, for its badge. */
export function useConversationJenticMode(
  conversationId: string | undefined,
  enabled: boolean,
): JenticMode | null {
  const { data } = useQuery({
    queryKey: ["jentic-mode", conversationId],
    queryFn: async () => {
      const r = await fetch(`/api/v1/llmkit/mode/${conversationId}`, {
        credentials: "same-origin",
      });
      if (!r.ok) return null;
      const d = await r.json();
      return d?.mode === "chat" || d?.mode === "agent"
        ? (d.mode as JenticMode)
        : null;
    },
    enabled: enabled && !!conversationId && !conversationId.startsWith("task-"),
    staleTime: Infinity,
    retry: false,
  });
  return data ?? null;
}
