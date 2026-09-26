/**
 * Fork: dictation records WAV in the page. The transcriber (llama.cpp's
 * /v1/audio/transcriptions, the "voice" model) decodes WAV, MP3 and FLAC only, and the
 * MediaRecorder on Android Chrome makes WebM/Opus. So the microphone's PCM is collected
 * through an AudioWorklet, averaged down to 16 kHz mono, and written with a RIFF header:
 * 32 KB per second, about 1.9 MB a minute.
 */

export const WAV_SAMPLE_RATE = 16000;

const WORKLET = `
class LlmkitPcm extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor("llmkit-pcm", LlmkitPcm);
`;

/** Averages each output sample's window of input samples: a box filter, enough for speech. */
export function downsample(
  input: Float32Array,
  fromRate: number,
  toRate: number = WAV_SAMPLE_RATE,
): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j += 1) sum += input[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

/** 16-bit PCM mono WAV. */
export function encodeWav(
  samples: Float32Array,
  rate: number = WAV_SAMPLE_RATE,
): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i += 1)
      view.setUint8(offset + i, s.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export interface WavRecording {
  /** Stops the microphone and returns the WAV, and how many seconds it holds. */
  stop: () => Promise<{ wav: Blob; seconds: number }>;
  /** Stops the microphone and drops what was recorded. */
  cancel: () => void;
}

export async function startWavRecording(): Promise<WavRecording> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("unavailable");
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  const ctx = new AudioContext();
  const chunks: Float32Array[] = [];
  let node: AudioWorkletNode;
  try {
    const url = URL.createObjectURL(
      new Blob([WORKLET], { type: "text/javascript" }),
    );
    try {
      await ctx.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    node = new AudioWorkletNode(ctx, "llmkit-pcm");
  } catch (error) {
    stream.getTracks().forEach((t) => t.stop());
    ctx.close();
    throw error;
  }
  node.port.onmessage = (event: MessageEvent<Float32Array>) => {
    chunks.push(event.data);
  };
  const source = ctx.createMediaStreamSource(stream);
  source.connect(node);

  // Releases the microphone, so the phone's recording indicator goes off.
  const release = () => {
    node.port.onmessage = null;
    source.disconnect();
    node.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    ctx.close();
  };

  return {
    stop: async () => {
      release();
      const length = chunks.reduce((n, c) => n + c.length, 0);
      const all = new Float32Array(length);
      let offset = 0;
      chunks.forEach((c) => {
        all.set(c, offset);
        offset += c.length;
      });
      const pcm = downsample(all, ctx.sampleRate);
      return {
        wav: encodeWav(pcm),
        seconds: pcm.length / WAV_SAMPLE_RATE,
      };
    },
    cancel: release,
  };
}
