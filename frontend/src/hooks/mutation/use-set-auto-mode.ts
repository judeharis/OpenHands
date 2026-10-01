import { useMutation } from "@tanstack/react-query";
import EventService from "#/api/event-service/event-service.api";
import type { V1SecurityAnalyzer } from "#/api/event-service/event-service.types";
import { usePolicyStore } from "#/stores/policy-store";
import {
  LLMKIT_ANALYZER_KIND,
  LLMKIT_CONFIRMATION_POLICY,
} from "#/hooks/use-ensure-llmkit-policy";

interface AutoTarget {
  id: string;
  conversation_url?: string | null;
  session_api_key?: string | null;
}

interface AutoVariables {
  targets: AutoTarget[];
  auto: boolean;
}

/**
 * Switch auto mode on the sandbox's LlmkitAnalyzer, for the conversation and its
 * planner together. Read-modify-write, so grants (from this client or the CLI)
 * are kept. Auto mode lets what would ask run, except what reaches past the
 * sandbox (llmkit_policy.core.auto_mode); the sandbox enforces it, not the UI.
 */
export const useSetAutoMode = () =>
  useMutation({
    mutationKey: ["set-auto-mode"],
    mutationFn: async ({ targets, auto }: AutoVariables) => {
      await Promise.all(
        targets
          .filter((t) => t.conversation_url)
          .map(async (t) => {
            const url = t.conversation_url as string;
            const info = await EventService.getConversationInfo(
              t.id,
              url,
              t.session_api_key,
            );
            const before = info.security_analyzer;
            const fresh = before?.kind !== LLMKIT_ANALYZER_KIND;
            const current: V1SecurityAnalyzer =
              fresh || !before ? { kind: LLMKIT_ANALYZER_KIND } : before;
            await EventService.setSecurityAnalyzer(
              t.id,
              url,
              { ...current, auto },
              t.session_api_key,
            );
            if (fresh)
              await EventService.setConfirmationPolicy(
                t.id,
                url,
                LLMKIT_CONFIRMATION_POLICY,
                t.session_api_key,
              );
            // A sandbox on an image from before auto mode drops the unknown field
            // and keeps asking: read it back rather than show "Auto" over a lie.
            const after = await EventService.getConversationInfo(
              t.id,
              url,
              t.session_api_key,
            );
            const held = !!after.security_analyzer?.auto;
            usePolicyStore.getState().setPolicy(t.id, {
              kind: LLMKIT_ANALYZER_KIND,
              grants: after.security_analyzer?.grants ?? current.grants ?? [],
              auto: held,
            });
            if (held !== auto)
              throw new Error(
                "This sandbox's image predates auto mode: rebuild it (jentic build-image) and reopen the conversation.",
              );
          }),
      );
      return auto;
    },
  });
