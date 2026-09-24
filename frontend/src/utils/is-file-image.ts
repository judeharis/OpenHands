import { MAX_INLINE_IMAGE_SIZE } from "#/utils/file-validation";

/**
 * Check if a file is an image.
 * @param file - The File object to check.
 * @returns True if the file is an image, false otherwise.
 */
export const isFileImage = (file: File): boolean =>
  file.type.startsWith("image/");

/**
 * Fork: an image small enough to go inline in the message. A bigger one is uploaded into the
 * sandbox as a file (see MAX_INLINE_IMAGE_SIZE), so it is not stored base64 in the history.
 */
export const isInlineImage = (file: File): boolean =>
  isFileImage(file) && file.size <= MAX_INLINE_IMAGE_SIZE;
