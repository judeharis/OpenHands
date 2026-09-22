import { useEffect, useRef } from "react";
import EventService from "#/api/event-service/event-service.api";
import { usePolicyStore } from "#/stores/policy-store";

export const LLMKIT_ANALYZER_KIND = "LlmkitAnalyzer";
export const LLMKIT_CONFIRMATION_POLICY = {
  kind: "ConfirmRisky",
  threshold: "MEDIUM",
  confirm_unknown: true,
};

interface PolicyTarget {
  id: string;
  conversation_url?: string | null;
  session_api_key?: string | null;
  sandbox_status?: string | null;
}

/**
 * Make sure every running conversation (the main one and the planner) uses the
 * kit's server-side policy: read-only and allow-listed actions run, writes ask.
 * New conversations start with it (the app sets it in the start request); this
 * covers ones created before that, and records the current grants for the
 * confirmation panel. Idempotent per conversation URL; a sandbox image without
 * llmkit_policy just leaves the stock behaviour (every action asks).
 */
export function useEnsureLlmkitPolicy(
  targets: Array<PolicyTarget | null | undefined>,
) {
  const setPolicy = usePolicyStore((state) => state.setPolicy);
  const done = useRef<Set<string>>(new Set());
  const key = targets
    .map((t) => (t ? `${t.id}:${t.sandbox_status}:${t.conversation_url}` : ""))
    .join("|");

  useEffect(() => {
    targets.forEach((t) => {
      if (!t || t.sandbox_status !== "RUNNING" || !t.conversation_url) return;
      const k = `${t.id}@${t.conversation_url}`;
      if (done.current.has(k)) return;
      done.current.add(k);
      const url = t.conversation_url;
      (async () => {
        try {
          const info = await EventService.getConversationInfo(
            t.id,
            url,
            t.session_api_key,
          );
          let analyzer = info.security_analyzer;
          if (analyzer?.kind !== LLMKIT_ANALYZER_KIND) {
            await EventService.setSecurityAnalyzer(
              t.id,
              url,
              { kind: LLMKIT_ANALYZER_KIND },
              t.session_api_key,
            );
            await EventService.setConfirmationPolicy(
              t.id,
              url,
              LLMKIT_CONFIRMATION_POLICY,
              t.session_api_key,
            );
            analyzer = { kind: LLMKIT_ANALYZER_KIND, grants: [] };
          }
          setPolicy(t.id, {
            kind: analyzer.kind,
            grants: analyzer.grants ?? [],
          });
        } catch (error) {
          done.current.delete(k);
          // eslint-disable-next-line no-console
          console.warn("llmkit policy not applied to", t.id, error);
        }
      })();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
