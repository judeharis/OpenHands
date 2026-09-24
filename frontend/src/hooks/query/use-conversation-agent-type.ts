import { useQuery } from "@tanstack/react-query";
import V1ConversationService from "#/api/conversation-service/v1-conversation-service.api";

/**
 * "plan" for a conversation started as a planner (Plan on the home screen, or
 * `jentic-cli plan`): its main agent can only write PLAN.md, so "build" has to start a code
 * agent elsewhere. Fixed at creation, so it is fetched once.
 */
export const useConversationAgentType = (conversationId: string | undefined) =>
  useQuery({
    queryKey: ["conversation-agent-type", conversationId],
    queryFn: () => V1ConversationService.getConversationAgentType(conversationId!),
    enabled: !!conversationId && !conversationId.startsWith("task-"),
    staleTime: Infinity,
    gcTime: Infinity,
  });
