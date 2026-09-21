import React from "react";
import { MessageEvent } from "#/types/v1/core";
import { ChatMessage } from "../../../features/chat/chat-message";
import { ImageCarousel } from "../../../features/images/image-carousel";
import { parseMessageFromEvent } from "../event-content-helpers/parse-message-from-event";
import { CriticResultDisplay } from "./critic-result-display";

interface UserAssistantEventMessageProps {
  event: MessageEvent;
  isFromPlanningAgent: boolean;
}

export function UserAssistantEventMessage({
  event,
  isFromPlanningAgent,
}: UserAssistantEventMessageProps) {
  const message = parseMessageFromEvent(event);

  const imageUrls: string[] = [];
  if (Array.isArray(event.llm_message.content)) {
    event.llm_message.content.forEach((content) => {
      if (content.type === "image") {
        imageUrls.push(...content.image_urls);
      }
    });
  }

  return (
    <>
      <ChatMessage
        type={event.source}
        message={message}
        isFromPlanningAgent={isFromPlanningAgent}
      >
        {imageUrls.length > 0 && (
          <ImageCarousel size="small" images={imageUrls} />
        )}
      </ChatMessage>
      {event.source === "agent" && event.critic_result != null && (
        <CriticResultDisplay criticResult={event.critic_result} />
      )}
    </>
  );
}
