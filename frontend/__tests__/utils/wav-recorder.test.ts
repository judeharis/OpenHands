import { describe, expect, it } from "vitest";
import { downsample, encodeWav } from "#/utils/wav-recorder";

const bytes = (blob: Blob) =>
  new Promise<DataView>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new DataView(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(blob);
  });
const ascii = (v: DataView, at: number, n: number) =>
  String.fromCharCode(
    ...Array.from({ length: n }, (_, i) => v.getUint8(at + i)),
  );

describe("downsample", () => {
  it("turns 48 kHz into a third as many 16 kHz samples, each the mean of its window", () => {
    const input = new Float32Array([0.3, 0.6, 0.9, -0.3, -0.6, -0.9]);
    const out = downsample(input, 48000);
    expect(out).toHaveLength(2);
    expect(out[0]).toBeCloseTo(0.6);
    expect(out[1]).toBeCloseTo(-0.6);
  });

  it("leaves 16 kHz alone", () => {
    const input = new Float32Array([0.1, 0.2]);
    expect(downsample(input, 16000)).toBe(input);
  });

  it("handles a rate that is not a whole multiple (44.1 kHz)", () => {
    expect(downsample(new Float32Array(44100), 44100)).toHaveLength(16000);
  });
});

describe("encodeWav", () => {
  it("writes a 16-bit mono 16 kHz PCM RIFF header llama.cpp recognises", async () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 2]));
    expect(wav.type).toBe("audio/wav");
    expect(wav.size).toBe(44 + 4 * 2);
    const v = await bytes(wav);
    expect(ascii(v, 0, 4)).toBe("RIFF");
    expect(ascii(v, 8, 4)).toBe("WAVE");
    expect(ascii(v, 12, 4)).toBe("fmt ");
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(22, true)).toBe(1); // mono
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint16(34, true)).toBe(16);
    expect(ascii(v, 36, 4)).toBe("data");
    expect(v.getUint32(40, true)).toBe(8);
    expect(v.getInt16(46, true)).toBe(0x7fff);
    expect(v.getInt16(48, true)).toBe(-0x8000);
    expect(v.getInt16(50, true)).toBe(0x7fff); // clipped
  });
});
