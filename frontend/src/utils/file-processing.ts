/**
 * Real file processing utilities using FileReader API
 * These functions perform actual file reading operations that take time for large files
 */

/**
 * Fork: read an attachment into memory once, when it is picked, and use that copy from
 * then on. On a phone the picked File is a live view of the camera's or gallery's copy:
 * Chrome reads it again at send time, and if that source has moved on (a camera capture
 * finishing its write, a gallery item re-synced) it aborts the upload mid-body. Seen
 * 2026-09-26: four camera-recorded .mp4s from the phone, each preflight answered and no
 * POST ever reaching the sandbox (nginx logged the one it saw as a 400 after 13 s of
 * body), while the same upload from the desktop took 60 MB in 1.6 s. A copy in memory
 * is read from nowhere else. The home composer holds attachments until the new
 * conversation's sandbox is up, so it needs the copy even more.
 */
export const snapshotFile = async (file: File): Promise<File> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(
        new File([reader.result as ArrayBuffer], file.name, {
          type: file.type,
          lastModified: file.lastModified,
        }),
      );
    };

    reader.onerror = () => {
      reject(
        new Error(
          `Failed to read file: ${file.name}${reader.error ? ` (${reader.error.message})` : ""}`,
        ),
      );
    };

    reader.onabort = () => {
      reject(new Error(`File reading was aborted: ${file.name}`));
    };

    reader.readAsArrayBuffer(file);
  });

/**
 * Process a regular file by reading its content into memory
 */
export const processFile = async (file: File): Promise<File> =>
  snapshotFile(file);

/**
 * Process an image file by reading its content into memory
 */
export const processImage = async (image: File): Promise<File> =>
  snapshotFile(image);

/**
 * Process multiple files concurrently with individual error handling
 */
export const processFiles = async (
  files: File[],
): Promise<{ successful: File[]; failed: { file: File; error: Error }[] }> => {
  const results = await Promise.allSettled(
    files.map(async (file) => processFile(file)),
  );

  const successful: File[] = [];
  const failed: { file: File; error: Error }[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      successful.push(result.value);
    } else {
      failed.push({ file: files[index], error: result.reason });
    }
  });

  return { successful, failed };
};

/**
 * Process multiple images concurrently with individual error handling
 */
export const processImages = async (
  images: File[],
): Promise<{ successful: File[]; failed: { file: File; error: Error }[] }> => {
  const results = await Promise.allSettled(
    images.map(async (image) => processImage(image)),
  );

  const successful: File[] = [];
  const failed: { file: File; error: Error }[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      successful.push(result.value);
    } else {
      failed.push({ file: images[index], error: result.reason });
    }
  });

  return { successful, failed };
};
