import { useTranslation } from "react-i18next";
import { Loader2, Mic, Square } from "lucide-react";
import { I18nKey } from "#/i18n/declaration";
import { cn } from "#/utils/utils";
import { useDictation } from "#/hooks/chat/use-dictation";

interface ChatMicButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

/** Fork: dictation. Tap to record, tap to stop; the text lands in the composer to edit. */
export function ChatMicButton({
  onTranscript,
  disabled = false,
}: ChatMicButtonProps) {
  const { t } = useTranslation();
  const { state, toggle } = useDictation(onTranscript);

  const label = {
    idle: t(I18nKey.CHAT_INTERFACE$START_DICTATION),
    recording: t(I18nKey.CHAT_INTERFACE$STOP_DICTATION),
    transcribing: t(I18nKey.CHAT_INTERFACE$TRANSCRIBING),
  }[state];

  return (
    <button
      type="button"
      data-testid="mic-button"
      data-state={state}
      aria-label={label}
      title={label}
      disabled={(disabled && state === "idle") || state === "transcribing"}
      onClick={toggle}
      className={cn(
        "relative shrink-0 h-[25px] w-[20px] flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95",
        "disabled:cursor-not-allowed disabled:hover:scale-100",
      )}
    >
      {state === "idle" && (
        <Mic size={20} color={disabled ? "#959CB2" : "white"} />
      )}
      {state === "recording" && (
        <Square size={16} className="text-red-500 fill-red-500 animate-pulse" />
      )}
      {state === "transcribing" && (
        <Loader2 size={20} className="text-white animate-spin" />
      )}
    </button>
  );
}
