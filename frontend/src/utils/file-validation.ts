/**
 * Fork: upstream capped every attachment at 3MB (b3c8b7c08, July 2025) because the old
 * socket.io server carried each one base64-encoded in a 4MB buffer. Files no longer travel
 * that way: they are uploaded over HTTP straight into the sandbox, streamed to disk, and the
 * jentic proxy takes 200MB (client_max_body_size). So files get the proxy's limit.
 *
 * Pasted images still go inline, base64 in the message itself, which is stored in the
 * conversation's history and replayed to the phone on every open. Those stay small: an image
 * over MAX_INLINE_IMAGE_SIZE is uploaded as a file instead (isInlineImage), where the utility
 * model and media_look still see it.
 */
export const MAX_FILE_SIZE = 200 * 1024 * 1024;
export const MAX_TOTAL_SIZE = 200 * 1024 * 1024; // all attachments of one message
export const MAX_INLINE_IMAGE_SIZE = 10 * 1024 * 1024;

const mb = (bytes: number) => `${Math.round(bytes / (1024 * 1024))}MB`;

export interface FileValidationResult {
  isValid: boolean;
  errorMessage?: string;
  oversizedFiles?: string[];
}

/**
 * Validates individual file sizes
 */
export function validateIndividualFileSizes(
  files: File[],
): FileValidationResult {
  const oversizedFiles = files.filter((file) => file.size > MAX_FILE_SIZE);

  if (oversizedFiles.length > 0) {
    const fileNames = oversizedFiles.map((f) => f.name);
    return {
      isValid: false,
      errorMessage: `Files exceeding ${mb(MAX_FILE_SIZE)} are not allowed: ${fileNames.join(", ")}`,
      oversizedFiles: fileNames,
    };
  }

  return { isValid: true };
}

/**
 * Validates total file size including existing files
 */
export function validateTotalFileSize(
  newFiles: File[],
  existingFiles: File[] = [],
): FileValidationResult {
  const currentTotalSize = existingFiles.reduce(
    (sum, file) => sum + file.size,
    0,
  );
  const newFilesSize = newFiles.reduce((sum, file) => sum + file.size, 0);
  const totalSize = currentTotalSize + newFilesSize;

  if (totalSize > MAX_TOTAL_SIZE) {
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(1);
    return {
      isValid: false,
      errorMessage: `Total file size would be ${totalSizeMB}MB, exceeding the ${mb(MAX_TOTAL_SIZE)} limit. Please select fewer or smaller files.`,
    };
  }

  return { isValid: true };
}

/**
 * Validates both individual and total file sizes
 */
export function validateFiles(
  newFiles: File[],
  existingFiles: File[] = [],
): FileValidationResult {
  // First check individual file sizes
  const individualValidation = validateIndividualFileSizes(newFiles);
  if (!individualValidation.isValid) {
    return individualValidation;
  }

  // Then check total size
  return validateTotalFileSize(newFiles, existingFiles);
}
