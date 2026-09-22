import axios from "axios";
import { buildHttpBaseUrl } from "#/utils/websocket-url";
import { buildSessionHeaders } from "#/utils/utils";
import type {
  ConfirmationResponseRequest,
  ConfirmationResponseResponse,
  V1ConfirmationPolicy,
  V1ConversationInfo,
  V1SecurityAnalyzer,
} from "./event-service.types";
import { openHands } from "../open-hands-axios";
import { OpenHandsEvent } from "#/types/v1/core";

class EventService {
  /**
   * Respond to a confirmation request in a V1 conversation
   * @param conversationId The conversation ID
   * @param conversationUrl The conversation URL (e.g., "http://localhost:54928/api/conversations/...")
   * @param request The confirmation response request
   * @param sessionApiKey Session API key for authentication (required for V1)
   * @returns The confirmation response
   */
  static async respondToConfirmation(
    conversationId: string,
    conversationUrl: string,
    request: ConfirmationResponseRequest,
    sessionApiKey?: string | null,
  ): Promise<ConfirmationResponseResponse> {
    // Build the runtime URL using the conversation URL
    const runtimeUrl = buildHttpBaseUrl(conversationUrl);

    // Build session headers for authentication
    const headers = buildSessionHeaders(sessionApiKey);

    // Make the API call to the runtime endpoint
    const { data } = await axios.post<ConfirmationResponseResponse>(
      `${runtimeUrl}/api/conversations/${conversationId}/events/respond_to_confirmation`,
      request,
      { headers },
    );

    return data;
  }

  /**
   * Get event count for a V1 conversation
   * @param conversationId The conversation ID
   * @param conversationUrl The conversation URL (e.g., "http://localhost:54928/api/conversations/...")
   * @param sessionApiKey Session API key for authentication (required for V1)
   * @returns The event count
   */
  static async getEventCount(
    conversationId: string,
    conversationUrl: string,
    sessionApiKey?: string | null,
  ): Promise<number> {
    // Build the runtime URL using the conversation URL
    const runtimeUrl = buildHttpBaseUrl(conversationUrl);

    // Build session headers for authentication
    const headers = buildSessionHeaders(sessionApiKey);

    const { data } = await axios.get<number>(
      `${runtimeUrl}/api/conversations/${conversationId}/events/count`,
      { headers },
    );
    return data;
  }

  /**
   * The sandbox's view of a conversation: execution status, security analyzer
   * (with its session grants) and confirmation policy.
   */
  static async getConversationInfo(
    conversationId: string,
    conversationUrl: string,
    sessionApiKey?: string | null,
  ): Promise<V1ConversationInfo> {
    const runtimeUrl = buildHttpBaseUrl(conversationUrl);
    const { data } = await axios.get<V1ConversationInfo>(
      `${runtimeUrl}/api/conversations/${conversationId}`,
      { headers: buildSessionHeaders(sessionApiKey) },
    );
    return data;
  }

  /** Replace the sandbox's security analyzer (null = none). */
  static async setSecurityAnalyzer(
    conversationId: string,
    conversationUrl: string,
    securityAnalyzer: V1SecurityAnalyzer | null,
    sessionApiKey?: string | null,
  ): Promise<void> {
    const runtimeUrl = buildHttpBaseUrl(conversationUrl);
    await axios.post(
      `${runtimeUrl}/api/conversations/${conversationId}/security_analyzer`,
      { security_analyzer: securityAnalyzer },
      { headers: buildSessionHeaders(sessionApiKey) },
    );
  }

  /** Replace the sandbox's confirmation policy. */
  static async setConfirmationPolicy(
    conversationId: string,
    conversationUrl: string,
    policy: V1ConfirmationPolicy,
    sessionApiKey?: string | null,
  ): Promise<void> {
    const runtimeUrl = buildHttpBaseUrl(conversationUrl);
    await axios.post(
      `${runtimeUrl}/api/conversations/${conversationId}/confirmation_policy`,
      { policy },
      { headers: buildSessionHeaders(sessionApiKey) },
    );
  }

  // V1 conversations — App Server REST endpoint
  static async searchEventsV1(conversationId: string, limit = 100) {
    const { data } = await openHands.get<{
      items: OpenHandsEvent[];
    }>(`/api/v1/conversation/${conversationId}/events/search`, {
      params: { limit },
    });

    return data.items;
  }

  /**
   * Every event of a V1 conversation from the App Server mirror, walking
   * next_page_id. The server caps a page at 100 and an archived conversation
   * has no live socket to replay from, so a single page showed only the first
   * hundred events of a much longer history (phone UX study, 2026-09-21).
   */
  static async fetchAllEventsV1(
    conversationId: string,
    maxEvents = 5000,
  ): Promise<OpenHandsEvent[]> {
    const items: OpenHandsEvent[] = [];
    let pageId: string | number | null = null;
    /* eslint-disable no-await-in-loop */
    do {
      const params: Record<string, string | number> = { limit: 100 };
      if (pageId !== null) params.page_id = pageId;
      const { data } = await openHands.get<{
        items: OpenHandsEvent[];
        next_page_id: string | number | null;
      }>(`/api/v1/conversation/${conversationId}/events/search`, { params });
      items.push(...data.items);
      pageId = data.next_page_id ?? null;
    } while (pageId !== null && items.length < maxEvents);
    /* eslint-enable no-await-in-loop */
    return items;
  }
}
export default EventService;
