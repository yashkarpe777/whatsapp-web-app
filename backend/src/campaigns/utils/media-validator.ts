export const ONE_MB = 1024 * 1024;

export const MEDIA_SIZE_LIMITS: Record<string, number> = {
  image: 2 * ONE_MB,
  video: 6 * ONE_MB,
  audio: 3 * ONE_MB,
  document: 3 * ONE_MB,
};

const AUDIO_MIME_PREFIXES = ["audio/"];
const DOCUMENT_MIME_PREFIXES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
];

const IMAGE_MIME_PREFIXES = ["image/"];
const VIDEO_MIME_PREFIXES = ["video/"];

export class CampaignMediaValidationError extends Error {
  constructor(public readonly mediaType: string, public readonly maxSize: number) {
    super(`Media exceeds the allowed size for type ${mediaType}`);
  }
}

function detectMediaTypeFromMime(mime?: string | null): string | null {
  if (!mime) return null;

  if (IMAGE_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) {
    return "image";
  }

  if (VIDEO_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) {
    return "video";
  }

  if (AUDIO_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) {
    return "audio";
  }

  if (
    DOCUMENT_MIME_PREFIXES.includes(mime) ||
    mime.startsWith("application/") ||
    mime.startsWith("text/")
  ) {
    return "document";
  }

  return null;
}

export interface CampaignMediaPayload {
  mediaType?: string | null;
  mediaUrl?: string | null;
  mediaName?: string | null;
  attachmentUrl?: string | null;
  mimeType?: string | null;
  mediaSize?: number | null;
}

export function validateCampaignMediaSize(payload: CampaignMediaPayload) {
  if (!payload) return;

  const hasMedia = Boolean(payload.mediaUrl || payload.attachmentUrl || payload.mediaName);
  if (!hasMedia) {
    return;
  }

  const detectedType = payload.mediaType || detectMediaTypeFromMime(payload.mimeType || undefined);
  if (!detectedType) {
    return;
  }

  const limit = MEDIA_SIZE_LIMITS[detectedType];
  if (!limit) {
    return;
  }

  const size = payload.mediaSize ?? 0;

  if (size > 0 && size > limit) {
    throw new CampaignMediaValidationError(detectedType, limit);
  }
}
