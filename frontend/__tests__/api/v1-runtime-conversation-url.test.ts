import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import V1ConversationService from "#/api/conversation-service/v1-conversation-service.api";

// Fork: behind the jentic proxy the conversation URL carries a /sb/<port> prefix, and it
// was put on the request twice -- Display Cost failed with "Not Found".
describe("V1ConversationService.getRuntimeConversation", () => {
  beforeEach(() => {
    vi.stubGlobal("location", {
      protocol: "https:",
      host: "jude.example.ts.net",
      hostname: "jude.example.ts.net",
    });
    vi.spyOn(axios, "get").mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const requested = () => vi.mocked(axios.get).mock.calls[0][0];

  it("puts a proxy prefix on the request once", async () => {
    await V1ConversationService.getRuntimeConversation(
      "abc",
      "http://localhost:40000/sb/59047/api/conversations/abc",
      "key",
    );
    expect(requested()).toBe(
      "https://jude.example.ts.net:40000/sb/59047/api/conversations/abc",
    );
  });

  it("leaves a URL without a prefix as it was", async () => {
    await V1ConversationService.getRuntimeConversation(
      "abc",
      "http://localhost:8000/api/conversations/abc",
      "key",
    );
    expect(requested()).toBe(
      "https://jude.example.ts.net:8000/api/conversations/abc",
    );
  });

  it("falls back to this host without a conversation URL", async () => {
    await V1ConversationService.getRuntimeConversation("abc", null, "key");
    expect(requested()).toBe(
      "https://jude.example.ts.net/api/conversations/abc",
    );
  });
});
