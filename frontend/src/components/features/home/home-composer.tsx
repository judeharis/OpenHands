import React from "react";
import { useNavigate } from "react-router";
import { ChatSendButton } from "#/components/features/chat/chat-send-button";
import { useCreateConversation } from "#/hooks/mutation/use-create-conversation";
import { useIsCreatingConversation } from "#/hooks/use-is-creating-conversation";

const MAX_HEIGHT = 200;
// Fork-only copy; not in translation.json, which upstream keeps complete.
const STARTING = "Starting…";
const PLACEHOLDER = "How can I help?";
const EMPTY_CONVERSATION = "Start an empty conversation";

/**
 * The composer is the home screen: type the first message here and the
 * conversation is created with it, instead of pressing a button, waiting for a
 * sandbox and then typing into an empty thread. The button remains underneath
 * for starting an empty conversation.
 */
export function HomeComposer() {
  const navigate = useNavigate();
  const {
    mutate: createConversation,
    isPending,
    isSuccess,
  } = useCreateConversation();
  const isCreatingConversationElsewhere = useIsCreatingConversation();
  const [value, setValue] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const isBusy = isPending || isSuccess || isCreatingConversationElsewhere;

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  };

  const start = (query?: string) => {
    if (isBusy) return;
    const text = (query ?? value).trim();
    createConversation(
      { query: text || undefined },
      {
        onSuccess: (data) => navigate(`/conversations/${data.conversation_id}`),
      },
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends on a real keyboard; on a touch keyboard it inserts a newline,
    // because there Enter is the only way to get one.
    const hasKeyboard =
      typeof window !== "undefined" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (event.key === "Enter" && !event.shiftKey && hasKeyboard) {
      event.preventDefault();
      start();
    }
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="rounded-3xl border border-[#3C3F45] bg-[#26282D] px-4 py-3 flex flex-col gap-3">
        <textarea
          ref={textareaRef}
          data-testid="home-composer"
          rows={1}
          value={value}
          disabled={isBusy}
          placeholder={PLACEHOLDER}
          onChange={(event) => {
            setValue(event.target.value);
            resize();
          }}
          onKeyDown={handleKeyDown}
          className="w-full resize-none bg-transparent text-white text-base leading-6 placeholder:text-[#A3A3A3] outline-none disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs leading-4 text-[#A3A3A3]">
            {isBusy ? STARTING : ""}
          </span>
          <ChatSendButton
            buttonClassName=""
            handleSubmit={() => start()}
            disabled={isBusy || !value.trim()}
          />
        </div>
      </div>

      <button
        type="button"
        data-testid="launch-new-conversation-button"
        onClick={() => start("")}
        disabled={isBusy}
        className="self-start text-sm leading-5 text-[#A3A3A3] hover:text-white disabled:opacity-60 cursor-pointer min-h-9"
      >
        {isBusy ? STARTING : EMPTY_CONVERSATION}
      </button>
    </div>
  );
}
