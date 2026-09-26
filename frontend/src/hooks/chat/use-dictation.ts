import React from "react";
import { useTranslation } from "react-i18next";
import { AxiosError } from "axios";
import { I18nKey } from "#/i18n/declaration";
import { displayErrorToast } from "#/utils/custom-toast-handlers";
import { startWavRecording, WavRecording } from "#/utils/wav-recorder";
import { transcribeSpeech } from "#/api/voice-service.api";

export type DictationState = "idle" | "recording" | "transcribing";

/** Five minutes: ~4,000 audio tokens, inside the voice model's 8,192-token slot. */
export const MAX_DICTATION_MS = 5 * 60 * 1000;
/** Shorter than this is a stray tap, not speech. */
const MIN_SECONDS = 0.3;

/**
 * Tap to record, tap again to stop: the speech is transcribed by the "voice" model and
 * handed to onTranscript, for the composer to put in the text box.
 */
export function useDictation(onTranscript: (text: string) => void) {
  const { t } = useTranslation();
  const [state, setState] = React.useState<DictationState>("idle");
  const recording = React.useRef<WavRecording | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTranscriptRef = React.useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const stop = React.useCallback(async () => {
    const rec = recording.current;
    if (!rec) return;
    recording.current = null;
    clearTimer();
    setState("transcribing");
    try {
      const { wav, seconds } = await rec.stop();
      if (seconds < MIN_SECONDS) return;
      const text = (await transcribeSpeech(wav)).trim();
      if (text) onTranscriptRef.current(text);
      else displayErrorToast(t(I18nKey.CHAT_INTERFACE$NO_SPEECH));
    } catch (error) {
      const detail =
        (error as AxiosError<{ detail?: string }>)?.response?.data?.detail ??
        (error as Error)?.message;
      displayErrorToast(
        `${t(I18nKey.CHAT_INTERFACE$DICTATION_FAILED)}${detail ? `: ${detail}` : ""}`,
      );
    } finally {
      setState("idle");
    }
  }, [t]);

  const start = React.useCallback(async () => {
    try {
      recording.current = await startWavRecording();
      setState("recording");
      timer.current = setTimeout(() => {
        stop();
      }, MAX_DICTATION_MS);
    } catch (error) {
      const name = (error as DOMException)?.name;
      displayErrorToast(
        t(
          name === "NotAllowedError" || name === "SecurityError"
            ? I18nKey.CHAT_INTERFACE$MIC_PERMISSION_DENIED
            : I18nKey.CHAT_INTERFACE$MIC_UNAVAILABLE,
        ),
      );
      setState("idle");
    }
  }, [stop, t]);

  const toggle = React.useCallback(() => {
    if (state === "idle") start();
    else if (state === "recording") stop();
  }, [state, start, stop]);

  // Leaving the page must not leave the microphone on.
  React.useEffect(
    () => () => {
      clearTimer();
      recording.current?.cancel();
      recording.current = null;
    },
    [],
  );

  return { state, toggle };
}
