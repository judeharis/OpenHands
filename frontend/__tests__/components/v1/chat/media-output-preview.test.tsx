import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import V1ConversationService from "#/api/conversation-service/v1-conversation-service.api";
import {
  MediaOutputPreview,
  mediaFiles,
  mediaOutputPath,
} from "#/components/v1/chat/event-message-components/media-output-preview";
import type { OpenHandsEvent } from "#/types/v1/core";

vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: () => ({
    data: {
      id: "c1",
      conversation_url: "http://localhost:40000/sb/1/api/conversations/c1",
      session_api_key: "k",
      sandbox_status: "RUNNING",
    },
  }),
}));

const observation = (tool: string, text: string, isError = false) =>
  ({
    id: "e1",
    timestamp: "2026-09-27T10:27:30",
    source: "environment",
    kind: "ObservationEvent",
    tool_name: tool,
    tool_call_id: "t1",
    action_id: "a1",
    observation: {
      kind: "MCPToolObservation",
      tool_name: tool,
      is_error: isError,
      content: [
        { type: "text", text: `[Tool '${tool}' executed.]` },
        { type: "text", text },
      ],
    },
  }) as unknown as OpenHandsEvent;

const DRAW = observation(
  "media_draw",
  "[utility draw · 62.4 s] wrote /workspace/media/out/20260927-apple.png (2053 KiB)",
);

describe("media output preview (jentic)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:preview");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("finds the file a draw or speak result names, and nothing else", () => {
    expect(mediaOutputPath(DRAW)).toEqual({
      path: "/workspace/media/out/20260927-apple.png",
      type: "image/png",
    });
    expect(
      mediaOutputPath(
        observation(
          "media_speak",
          "[utility speak · 3.9 s] wrote /workspace/media/out/hi.wav (172 KiB)",
        ),
      )?.type,
    ).toBe("audio/wav");
    expect(
      mediaOutputPath(
        observation(
          "media_draw",
          "media: the media service is not running",
          true,
        ),
      ),
    ).toBeNull();
    expect(
      mediaOutputPath(observation("terminal", "wrote /workspace/x.png")),
    ).toBeNull();
  });

  it("shows the files media_look was asked about, from its action", () => {
    const look = observation(
      "media_look",
      "[utility …] A red apple on a wooden door.",
    );
    const action = {
      id: "a1",
      kind: "ActionEvent",
      tool_name: "media_look",
      action: {
        kind: "MCPToolAction",
        data: {
          paths: [
            "/workspace/media/out/apple.png",
            "/etc/passwd",
            "/workspace/notes.txt",
          ],
        },
      },
    } as unknown as OpenHandsEvent;
    expect(mediaFiles(look, action)).toEqual([
      { path: "/workspace/media/out/apple.png", type: "image/png" },
    ]);
    expect(mediaFiles(look)).toEqual([]);
  });

  it("fetches the picture from the sandbox and shows it", async () => {
    const download = vi
      .spyOn(V1ConversationService, "downloadFile")
      .mockResolvedValue(new Blob(["png"]));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MediaOutputPreview event={DRAW} />
      </QueryClientProvider>,
    );

    const img = await screen.findByRole("img");
    expect(img).toHaveAttribute("src", "blob:preview");
    expect(img).toHaveAttribute("alt", "20260927-apple.png");
    expect(download).toHaveBeenCalledWith(
      "http://localhost:40000/sb/1/api/conversations/c1",
      "k",
      "/workspace/media/out/20260927-apple.png",
    );
  });

  it("shows nothing when the file cannot be fetched", async () => {
    vi.spyOn(V1ConversationService, "downloadFile").mockRejectedValue(
      new Error("404"),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { container } = render(
      <QueryClientProvider client={client}>
        <MediaOutputPreview event={DRAW} />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(V1ConversationService.downloadFile).toHaveBeenCalled(),
    );
    expect(container).toBeEmptyDOMElement();
  });
});
