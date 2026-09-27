import React from "react";
import { useQuery } from "@tanstack/react-query";
import V1ConversationService from "#/api/conversation-service/v1-conversation-service.api";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import type { OpenHandsEvent } from "#/types/v1/core";
import { isObservationEvent } from "#/types/v1/type-guards";

/**
 * Fork: the media the utility tools made or examined, shown under their tool result.
 * media_draw and media_speak answer "wrote /workspace/media/out/<name>.png (… KiB)";
 * media_look, media_listen and media_watch name their files in the action's `paths`.
 * Each file is fetched from the sandbox (GET /api/file/download) and shown as a picture
 * or a player, so "can you show it" is answered by the agent looking at the file. Nothing
 * is shown when the sandbox is gone (an archived conversation): the path is still in the text.
 */
const WROTE = /wrote (\/workspace\/\S+?\.(png|jpe?g|webp|gif|wav|mp3|ogg))\b/i;
const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};
const MAX_SHOWN = 4;

export interface MediaFile {
  path: string;
  type: string;
}

const typeOf = (path: string) =>
  TYPES[(path.split(".").pop() ?? "").toLowerCase()];

export function mediaFiles(
  event: OpenHandsEvent,
  action?: OpenHandsEvent,
): MediaFile[] {
  if (!isObservationEvent(event)) return [];
  const obs = event.observation as {
    kind?: string;
    tool_name?: string;
    is_error?: boolean;
    content?: { type: string; text?: string }[];
  };
  if (obs.kind !== "MCPToolObservation" || obs.is_error) return [];
  const tool = obs.tool_name ?? "";
  if (/^media_(draw|speak)$/.test(tool)) {
    const text = (obs.content ?? []).map((c) => c.text ?? "").join("\n");
    const m = text.match(WROTE);
    return m ? [{ path: m[1], type: typeOf(m[1]) }] : [];
  }
  if (/^media_(look|listen|watch)$/.test(tool) && action) {
    const data = (action as { action?: { data?: { paths?: unknown } } }).action
      ?.data;
    const paths = Array.isArray(data?.paths) ? data.paths : [];
    return paths
      .filter(
        (p): p is string =>
          typeof p === "string" && p.startsWith("/workspace/") && !!typeOf(p),
      )
      .slice(0, MAX_SHOWN)
      .map((p) => ({ path: p, type: typeOf(p) }));
  }
  return [];
}

/** Kept for callers that only have the result: the file a draw or speak result names. */
export function mediaOutputPath(event: OpenHandsEvent): MediaFile | null {
  return mediaFiles(event)[0] ?? null;
}

function MediaFileView({ file }: { file: MediaFile }) {
  const { data: conversation } = useActiveConversation();
  const url = conversation?.conversation_url;
  const key = conversation?.session_api_key;
  const { data: blob, isError } = useQuery({
    queryKey: ["media-output", conversation?.id, file.path, url, key],
    queryFn: () => V1ConversationService.downloadFile(url, key, file.path),
    enabled: !!url && conversation?.sandbox_status === "RUNNING",
    staleTime: Infinity,
    retry: 1,
  });
  const objectUrl = React.useMemo(
    () =>
      blob ? URL.createObjectURL(new Blob([blob], { type: file.type })) : null,
    [blob, file.type],
  );
  React.useEffect(
    () => () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
    [objectUrl],
  );

  if (isError || !objectUrl) return null;
  const name = file.path.split("/").pop();
  if (file.type.startsWith("audio/")) {
    return (
      <div className="my-2" data-testid="media-output-preview">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio
          controls
          src={objectUrl}
          className="w-full max-w-md"
          aria-label={name}
        />
      </div>
    );
  }
  if (file.type.startsWith("video/")) {
    return (
      <div className="my-2" data-testid="media-output-preview">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          controls
          src={objectUrl}
          className="max-w-full md:max-w-md max-h-96 rounded-lg"
          aria-label={name}
        />
      </div>
    );
  }
  return (
    <a
      href={objectUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block my-2 w-fit"
      data-testid="media-output-preview"
      title={`${name}: open full size`}
    >
      <img
        src={objectUrl}
        alt={name}
        className="max-w-full md:max-w-md max-h-96 rounded-lg border border-[#525252] object-contain"
      />
    </a>
  );
}

export function MediaOutputPreview({
  event,
  action,
}: {
  event: OpenHandsEvent;
  action?: OpenHandsEvent;
}) {
  const files = mediaFiles(event, action);
  if (!files.length) return null;
  return (
    <>
      {files.map((f) => (
        <MediaFileView key={f.path} file={f} />
      ))}
    </>
  );
}
