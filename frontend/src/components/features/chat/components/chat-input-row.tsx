import React from "react";
import { cn } from "#/utils/utils";
import { ChatAddFileButton } from "../chat-add-file-button";
import { ChatMicButton } from "../chat-mic-button";
import { ChatSendButton } from "../chat-send-button";
import { ChatInputField } from "./chat-input-field";

interface ChatInputRowProps {
  chatInputRef: React.RefObject<HTMLDivElement | null>;
  disabled: boolean;
  isNewConversationPending?: boolean;
  showButton: boolean;
  buttonClassName: string;
  handleFileIconClick: (isDisabled: boolean) => void;
  handleSubmit: () => void;
  onInput: () => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function ChatInputRow({
  chatInputRef,
  disabled,
  isNewConversationPending = false,
  showButton,
  buttonClassName,
  handleFileIconClick,
  handleSubmit,
  onInput,
  onPaste,
  onKeyDown,
  onFocus,
  onBlur,
}: ChatInputRowProps) {
  // Dictated text goes in at the end, as if typed: insertText fires the input event, so the
  // draft, the height and the placeholder follow. Without it (tests) the text is set directly.
  const insertTranscript = (text: string) => {
    const el = chatInputRef.current;
    if (!el) return;
    const before = el.innerText ?? el.textContent ?? "";
    const piece = before && !/\s$/.test(before) ? ` ${text}` : text;
    el.focus();
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    if (!document.execCommand?.("insertText", false, piece)) {
      el.textContent = before + piece;
      onInput();
    }
  };

  return (
    <div className="box-border content-stretch flex flex-row items-end justify-between p-0 relative shrink-0 w-full pb-[18px] gap-2">
      <div className="basis-0 box-border content-stretch flex flex-row gap-4 grow items-end justify-start min-h-px min-w-px p-0 relative shrink-0">
        <ChatAddFileButton
          disabled={disabled}
          handleFileIconClick={() => handleFileIconClick(disabled)}
        />

        <ChatMicButton onTranscript={insertTranscript} disabled={disabled} />

        <ChatInputField
          chatInputRef={chatInputRef}
          disabled={isNewConversationPending}
          onInput={onInput}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      </div>

      {/* Send Button */}
      {showButton && (
        <ChatSendButton
          buttonClassName={cn(buttonClassName, "translate-y-[3px]")}
          handleSubmit={handleSubmit}
          disabled={disabled}
        />
      )}
    </div>
  );
}
