import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { ChatMicButton } from "#/components/features/chat/chat-mic-button";
import { ChatInputRow } from "#/components/features/chat/components/chat-input-row";
import { startWavRecording } from "#/utils/wav-recorder";
import { transcribeSpeech } from "#/api/voice-service.api";
import { displayErrorToast } from "#/utils/custom-toast-handlers";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("#/utils/wav-recorder", () => ({ startWavRecording: vi.fn() }));
vi.mock("#/api/voice-service.api", () => ({ transcribeSpeech: vi.fn() }));
vi.mock("#/utils/custom-toast-handlers", () => ({
  displayErrorToast: vi.fn(),
}));

const recording = (seconds = 2) => ({
  stop: vi.fn().mockResolvedValue({
    wav: new Blob(["RIFF"], { type: "audio/wav" }),
    seconds,
  }),
  cancel: vi.fn(),
});

describe("dictation (jentic)", () => {
  beforeEach(() => {
    vi.mocked(startWavRecording).mockReset();
    vi.mocked(transcribeSpeech).mockReset();
    vi.mocked(displayErrorToast).mockReset();
  });

  it("records on the first tap, transcribes on the second and hands the text on", async () => {
    const rec = recording();
    vi.mocked(startWavRecording).mockResolvedValue(rec);
    vi.mocked(transcribeSpeech).mockResolvedValue("add a dark mode toggle");
    const onTranscript = vi.fn();
    render(<ChatMicButton onTranscript={onTranscript} />);
    const button = screen.getByTestId("mic-button");

    await userEvent.click(button);
    await waitFor(() =>
      expect(button).toHaveAttribute("data-state", "recording"),
    );
    await userEvent.click(button);

    await waitFor(() =>
      expect(onTranscript).toHaveBeenCalledWith("add a dark mode toggle"),
    );
    expect(rec.stop).toHaveBeenCalledOnce();
    expect(button).toHaveAttribute("data-state", "idle");
  });

  it("says so when the microphone is refused", async () => {
    vi.mocked(startWavRecording).mockRejectedValue(
      new DOMException("denied", "NotAllowedError"),
    );
    render(<ChatMicButton onTranscript={vi.fn()} />);

    await userEvent.click(screen.getByTestId("mic-button"));

    await waitFor(() =>
      expect(displayErrorToast).toHaveBeenCalledWith(
        "CHAT_INTERFACE$MIC_PERMISSION_DENIED",
      ),
    );
    expect(screen.getByTestId("mic-button")).toHaveAttribute(
      "data-state",
      "idle",
    );
  });

  it("shows the server's reason when transcription fails", async () => {
    vi.mocked(startWavRecording).mockResolvedValue(recording());
    vi.mocked(transcribeSpeech).mockRejectedValue({
      response: { data: { detail: "voice model 'voice' answered 404" } },
    });
    const onTranscript = vi.fn();
    render(<ChatMicButton onTranscript={onTranscript} />);
    const button = screen.getByTestId("mic-button");

    await userEvent.click(button);
    await waitFor(() =>
      expect(button).toHaveAttribute("data-state", "recording"),
    );
    await userEvent.click(button);

    await waitFor(() =>
      expect(displayErrorToast).toHaveBeenCalledWith(
        "CHAT_INTERFACE$DICTATION_FAILED: voice model 'voice' answered 404",
      ),
    );
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it("does not send a stray tap to the transcriber", async () => {
    vi.mocked(startWavRecording).mockResolvedValue(recording(0.1));
    render(<ChatMicButton onTranscript={vi.fn()} />);
    const button = screen.getByTestId("mic-button");

    await userEvent.click(button);
    await waitFor(() =>
      expect(button).toHaveAttribute("data-state", "recording"),
    );
    await userEvent.click(button);

    await waitFor(() => expect(button).toHaveAttribute("data-state", "idle"));
    expect(transcribeSpeech).not.toHaveBeenCalled();
  });

  it("releases the microphone when the composer goes away mid-recording", async () => {
    const rec = recording();
    vi.mocked(startWavRecording).mockResolvedValue(rec);
    const { unmount } = render(<ChatMicButton onTranscript={vi.fn()} />);
    await userEvent.click(screen.getByTestId("mic-button"));
    await waitFor(() =>
      expect(screen.getByTestId("mic-button")).toHaveAttribute(
        "data-state",
        "recording",
      ),
    );

    unmount();

    expect(rec.cancel).toHaveBeenCalledOnce();
  });

  it("appends the transcript to what is already typed in the chat box", async () => {
    vi.mocked(startWavRecording).mockResolvedValue(recording());
    vi.mocked(transcribeSpeech).mockResolvedValue("then run the tests");
    const onInput = vi.fn();
    function Row() {
      const ref = React.useRef<HTMLDivElement>(null);
      return (
        <ChatInputRow
          chatInputRef={ref}
          disabled={false}
          showButton
          buttonClassName=""
          handleFileIconClick={vi.fn()}
          handleSubmit={vi.fn()}
          onInput={onInput}
          onPaste={vi.fn()}
          onKeyDown={vi.fn()}
        />
      );
    }
    render(<Row />);
    const input = screen.getByTestId("chat-input");
    input.textContent = "fix the login bug";
    const button = screen.getByTestId("mic-button");

    await userEvent.click(button);
    await waitFor(() =>
      expect(button).toHaveAttribute("data-state", "recording"),
    );
    await userEvent.click(button);

    await waitFor(() =>
      expect(input.textContent).toBe("fix the login bug then run the tests"),
    );
    expect(onInput).toHaveBeenCalled();
  });
});
