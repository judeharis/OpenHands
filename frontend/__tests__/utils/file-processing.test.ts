import { describe, expect, it } from "vitest";
import { processFiles, snapshotFile } from "#/utils/file-processing";

// jsdom's Blob has no text()
const readText = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });

describe("snapshotFile", () => {
  it("returns an in-memory copy with the same name, type, bytes and date", async () => {
    const original = new File(["abc123"], "clip.mp4", {
      type: "video/mp4",
      lastModified: 1_700_000_000_000,
    });

    const copy = await snapshotFile(original);

    expect(copy).not.toBe(original);
    expect(copy.name).toBe("clip.mp4");
    expect(copy.type).toBe("video/mp4");
    expect(copy.lastModified).toBe(1_700_000_000_000);
    expect(await readText(copy)).toBe("abc123");
  });
});

describe("processFiles", () => {
  it("hands back the copies, not the picked files", async () => {
    const picked = new File(["x"], "tone.m4a", { type: "audio/mp4" });

    const { successful, failed } = await processFiles([picked]);

    expect(failed).toEqual([]);
    expect(successful).toHaveLength(1);
    expect(successful[0]).not.toBe(picked);
    expect(successful[0].name).toBe("tone.m4a");
  });
});
