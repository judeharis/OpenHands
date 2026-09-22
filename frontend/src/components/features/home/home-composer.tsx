import React from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import CodeTagIcon from "#/icons/code-tag.svg?react";
import LessonPlanIcon from "#/icons/lesson-plan.svg?react";
import { ChatSendButton } from "#/components/features/chat/chat-send-button";
import { useCreateConversation } from "#/hooks/mutation/use-create-conversation";
import { useIsCreatingConversation } from "#/hooks/use-is-creating-conversation";
import { cn } from "#/utils/utils";

const MAX_HEIGHT = 200;
// Fork-only copy; not in translation.json, which upstream keeps complete.
const STARTING = "Starting…";
const PLACEHOLDER = "How can I help?";
const EMPTY_CONVERSATION = "Start an empty conversation";

type Mode = "default" | "plan";

/**
 * The composer is the home screen: type the first message here and the
 * conversation is created with it, instead of pressing a button, waiting for a
 * sandbox and then typing into an empty thread. The button remains underneath
 * for starting an empty conversation.
 *
 * Code or Plan is chosen here too. The agent type can only be set when the
 * conversation is created -- the in-conversation switcher starts a *sub*-conversation
 * for planning -- so without this control the only way to begin in plan mode was
 * `jentic-cli plan`.
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
  const [mode, setMode] = React.useState<Mode>("default");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const { t } = useTranslation();

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
      { query: text || undefined, agentType: mode },
      {
        onSuccess: (data) => navigate(`/conversations/${data.conversation_id}`),
      },
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends on a real keyboard; on a touch keyboard it inserts a newline,
    // because there Enter is the only way to get one.
    // typeof the function, not just of window: jsdom (and anything without matchMedia)
    // threw here on every keystroke, out of a key handler, where it is invisible.
    const hasKeyboard =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
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
          <div className="flex items-center gap-1" data-testid="home-mode-toggle">
            {(
              [
                ["default", CodeTagIcon, t(I18nKey.COMMON$CODE), t(I18nKey.COMMON$CODE_AGENT_DESCRIPTION)],
                ["plan", LessonPlanIcon, t(I18nKey.COMMON$PLAN), t(I18nKey.COMMON$PLAN_AGENT_DESCRIPTION)],
              ] as const
            ).map(([value_, Icon, label, description]) => (
              <button
                key={value_}
                type="button"
                data-testid={`home-mode-${value_}`}
                aria-pressed={mode === value_}
                title={description}
                disabled={isBusy}
                onClick={() => setMode(value_)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 min-h-9 text-xs leading-4 cursor-pointer disabled:opacity-60",
                  mode === value_
                    ? "bg-[#3C3F45] text-white"
                    : "text-[#A3A3A3] hover:text-white",
                )}
              >
                <Icon width={14} height={14} />
                {label}
              </button>
            ))}
          </div>
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
