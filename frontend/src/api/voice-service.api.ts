import { openHands } from "./open-hands-axios";

/**
 * Fork: POST /api/v1/llmkit/transcribe, added to the app by jentic's sitecustomize. The app
 * forwards the WAV to the LLM server's "voice" model and keeps the API key to itself.
 */
export async function transcribeSpeech(wav: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", wav, "speech.wav");
  const { data } = await openHands.post<{ text: string }>(
    "/api/v1/llmkit/transcribe",
    form,
  );
  return data.text;
}
