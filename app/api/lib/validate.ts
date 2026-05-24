const ALLOWED_BLOB_HOSTS = [
  "vercel-storage.com",
  "blob.vercel-storage.com",
  "public.blob.vercel-storage.com",
];

export function isAllowedBlobUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "https:") return false;
    return ALLOWED_BLOB_HOSTS.some(
      (h) => hostname === h || hostname.endsWith(`.${h}`)
    );
  } catch {
    return false;
  }
}

export function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,256}$/.test(id);
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, "_")
    .slice(0, 64) || "upload";
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export function isAllowedMimeType(type: string): boolean {
  return ALLOWED_MIME_TYPES.has(type);
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export function isAllowedFileSize(size: number): boolean {
  return size > 0 && size <= MAX_FILE_BYTES;
}

/* Simple in-process rate limiter — best-effort per warm Lambda instance.
   For production use Upstash Redis + @upstash/ratelimit instead. */
const windows = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || now >= entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= maxPerMinute) return false;
  entry.count++;
  return true;
}
