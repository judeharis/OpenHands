import { useMutation } from "@tanstack/react-query";
import EventService from "#/api/event-service/event-service.api";
import { usePolicyStore } from "#/stores/policy-store";
import {
  LLMKIT_ANALYZER_KIND,
  LLMKIT_CONFIRMATION_POLICY,
} from "#/hooks/use-ensure-llmkit-policy";

interface GrantVariables {
  conversationId: string;
  conversationUrl: string;
  sessionApiKey?: string | null;
  grants: string[];
}

/**
 * "Allow for session": add grants (write:<dir>/, cmd:<prefix>, tool:<name>, …)
 * to the sandbox's LlmkitAnalyzer. Read-modify-write on the analyzer the sandbox
 * holds, so grants from other clients (the CLI) are kept.
 */
export const useGrantSessionAllow = () =>
  useMutation({
    mutationKey: ["grant-session-allow"],
    mutationFn: async ({
      conversationId,
      conversationUrl,
      sessionApiKey,
      grants,
    }: GrantVariables) => {
      const info = await EventService.getConversationInfo(
        conversationId,
        conversationUrl,
        sessionApiKey,
      );
      const current =
        info.security_analyzer?.kind === LLMKIT_ANALYZER_KIND
          ? info.security_analyzer
          : { kind: LLMKIT_ANALYZER_KIND };
      const merged = Array.from(
        new Set([...(current.grants ?? []), ...grants]),
      );
      await EventService.setSecurityAnalyzer(
        conversationId,
        conversationUrl,
        { ...current, grants: merged },
        sessionApiKey,
      );
      if (info.security_analyzer?.kind !== LLMKIT_ANALYZER_KIND) {
        await EventService.setConfirmationPolicy(
          conversationId,
          conversationUrl,
          LLMKIT_CONFIRMATION_POLICY,
          sessionApiKey,
        );
      }
      return merged;
    },
    onSuccess: (merged, variables) => {
      usePolicyStore.getState().setPolicy(variables.conversationId, {
        kind: LLMKIT_ANALYZER_KIND,
        grants: merged,
      });
    },
  });
