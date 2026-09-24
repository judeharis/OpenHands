import React from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import CodeTagIcon from "#/icons/code-tag.svg?react";
import LessonPlanIcon from "#/icons/lesson-plan.svg?react";
import { ChatSendButton } from "#/components/features/chat/chat-send-button";
import { ChatAddFileButton } from "#/components/features/chat/chat-add-file-button";
import { HiddenFileInput } from "#/components/features/chat/components/hidden-file-input";
import { UploadedFile } from "#/components/features/chat/uploaded-file";
import { UploadedImage } from "#/components/features/chat/uploaded-image";
import { usePendingFirstMessageStore } from "#/stores/pending-first-message-store";
import { convertImageToBase64 } from "#/utils/convert-image-to-base-64";
import { displayErrorToast } from "#/utils/custom-toast-handlers";
import { validateFiles } from "#/utils/file-validation";
import { isInlineImage } from "#/utils/is-file-image";
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
 * Code or Plan is chosen here too. A Plan is one conversation, as upstream's in-chat
 * Plan chip makes it: a code conversation with the planner inside it as a sub-conversation,
 * so Build is a switch of mode on the same page and not a second conversation. It starts
 * as an empty code conversation and the first message waits (pending-first-message-store,
 * mode "plan") until the chat can start the planner with it (use-start-planner).
 *
 * Attachments too, as in the chat. Images go in the first message of the create
 * request. Other files have to be uploaded into the sandbox, which only exists once the
 * conversation has started, so a message with files starts an empty conversation and is
 * sent by its chat when the sandbox is up (pending-first-message-store).
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
  const [images, setImages] = React.useState<File[]>([]);
  const [files, setFiles] = React.useState<File[]>([]);
  const [isPreparing, setIsPreparing] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const holdFirstMessage = usePendingFirstMessageStore((s) => s.hold);
  const { t } = useTranslation();

  const isBusy =
    isPreparing || isPending || isSuccess || isCreatingConversationElsewhere;
  const hasAttachments = images.length + files.length > 0;

  const attach = (selected: File[]) => {
    const validation = validateFiles(selected, [...images, ...files]);
    if (!validation.isValid) {
      displayErrorToast(`Error: ${validation.errorMessage}`);
      return;
    }
    setImages((prev) => [...prev, ...selected.filter(isInlineImage)]);
    setFiles((prev) => [
      ...prev,
      ...selected.filter((file) => !isInlineImage(file)),
    ]);
  };

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  };

  // `query` is given only by "Start an empty conversation", which leaves attachments out.
  const start = async (query?: string) => {
    if (isBusy) return;
    const text = (query ?? value).trim();
    const withAttachments = query === undefined && hasAttachments;
    const open = (conversationId: string) =>
      navigate(`/conversations/${conversationId}`);

    if ((withAttachments && files.length > 0) || mode === "plan") {
      createConversation(
        { agentType: "default" },
        {
          onSuccess: (data) => {
            if (data.v1_task_id)
              holdFirstMessage({
                taskId: data.v1_task_id,
                text,
                images: withAttachments ? images : [],
                files: withAttachments ? files : [],
                ...(mode === "plan" ? { mode } : {}),
              });
            open(data.conversation_id);
          },
        },
      );
      return;
    }

    let imageUrls: string[] | undefined;
    if (withAttachments) {
      setIsPreparing(true);
      try {
        imageUrls = await Promise.all(images.map(convertImageToBase64));
      } catch {
        displayErrorToast("Could not read an attached image");
        return;
      } finally {
        setIsPreparing(false);
      }
    }
    createConversation(
      { query: text || undefined, imageUrls, agentType: "default" },
      { onSuccess: (data) => open(data.conversation_id) },
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
        {hasAttachments && (
          <div
            data-testid="home-attachments"
            className="flex items-center gap-4 w-full overflow-x-auto custom-scrollbar"
          >
            {files.map((file, index) => (
              <UploadedFile
                key={`file-${index}-${file.name}`}
                file={file}
                onRemove={() =>
                  setFiles((prev) => prev.filter((_, i) => i !== index))
                }
              />
            ))}
            {images.map((image, index) => (
              <UploadedImage
                key={`image-${index}-${image.name}`}
                image={image}
                onRemove={() =>
                  setImages((prev) => prev.filter((_, i) => i !== index))
                }
              />
            ))}
          </div>
        )}
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
          <div
            className="flex items-center gap-1"
            data-testid="home-mode-toggle"
          >
            <span className="flex items-center justify-center min-w-9 min-h-9">
              <ChatAddFileButton
                disabled={isBusy}
                handleFileIconClick={() =>
                  !isBusy && fileInputRef.current?.click()
                }
              />
            </span>
            <HiddenFileInput
              fileInputRef={fileInputRef}
              onChange={(event) => {
                if (event.target.files) attach(Array.from(event.target.files));
                // The same file can be picked again after it is removed.
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            {(
              [
                [
                  "default",
                  CodeTagIcon,
                  t(I18nKey.COMMON$CODE),
                  t(I18nKey.COMMON$CODE_AGENT_DESCRIPTION),
                ],
                [
                  "plan",
                  LessonPlanIcon,
                  t(I18nKey.COMMON$PLAN),
                  t(I18nKey.COMMON$PLAN_AGENT_DESCRIPTION),
                ],
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
            disabled={isBusy || (!value.trim() && !hasAttachments)}
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
