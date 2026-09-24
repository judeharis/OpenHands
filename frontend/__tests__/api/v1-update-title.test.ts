import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { openHands } from "#/api/open-hands-axios";
import V1ConversationService from "#/api/conversation-service/v1-conversation-service.api";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return { default: { ...actual.default, patch: vi.fn() } };
});

describe("renaming a conversation (jentic)", () => {
  beforeEach(() => vi.clearAllMocks());

  // The agent-server auto-titles a conversation whose own title is empty, and the app copies
  // that back: a rename made in the app alone was overwritten by its first message.
  it("sets the title in the sandbox too, so the first message cannot overwrite it", async () => {
    vi.spyOn(openHands, "patch").mockResolvedValue({
      data: { id: "c1", conversation_url: "http://localhost:40000/sb/34871/api/conversations/c1", session_api_key: "k" },
    });
    await V1ConversationService.updateConversationTitle("c1", "Plan a tiny script");
    expect(openHands.patch).toHaveBeenCalledWith("/api/v1/app-conversations/c1", { title: "Plan a tiny script" });
    expect(axios.patch).toHaveBeenCalledWith(
      "http://localhost:40000/sb/34871/api/conversations/c1",
      { title: "Plan a tiny script" },
      { headers: expect.objectContaining({ "X-Session-API-Key": "k" }) },
    );
  });

  it("keeps the app's title when the sandbox is not running", async () => {
    vi.spyOn(openHands, "patch").mockResolvedValue({ data: { id: "c1", conversation_url: null } });
    await V1ConversationService.updateConversationTitle("c1", "x");
    expect(axios.patch).not.toHaveBeenCalled();
  });
});
