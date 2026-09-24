import { describe, expect, it } from "vitest";
import { validateFiles } from "#/utils/file-validation";
import { isInlineImage } from "#/utils/is-file-image";

const MB = 1024 * 1024;
const sized = (name: string, type: string, bytes: number) => {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: bytes });
  return f;
};

describe("attachment limits (jentic)", () => {
  // Upstream's 3MB was the old socket.io buffer; files now go over HTTP into the sandbox.
  it("takes a voice note or a short video far over the old 3MB", () => {
    expect(validateFiles([sized("note.m4a", "audio/mp4", 25 * MB)]).isValid).toBe(true);
    expect(validateFiles([sized("clip.mp4", "video/mp4", 150 * MB)]).isValid).toBe(true);
  });

  it("stops at the proxy's 200MB, per file and per message", () => {
    const one = validateFiles([sized("big.mp4", "video/mp4", 201 * MB)]);
    expect(one.isValid).toBe(false);
    expect(one.errorMessage).toContain("exceeding 200MB");
    const two = validateFiles([sized("b.mp4", "video/mp4", 120 * MB)], [sized("a.mp4", "video/mp4", 120 * MB)]);
    expect(two.isValid).toBe(false);
    expect(two.errorMessage).toContain("the 200MB limit");
  });

  it("sends a small image inline and a large one as a file", () => {
    expect(isInlineImage(sized("shot.png", "image/png", 2 * MB))).toBe(true);
    expect(isInlineImage(sized("photo.jpg", "image/jpeg", 12 * MB))).toBe(false);
    expect(isInlineImage(sized("notes.pdf", "application/pdf", 1 * MB))).toBe(false);
  });
});
