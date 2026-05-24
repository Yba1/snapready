import { put } from "@vercel/blob";
import { NextRequest } from "next/server";
import {
  isAllowedMimeType,
  isAllowedFileSize,
  sanitizeFilename,
  checkRateLimit,
} from "../lib/validate";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(`upload:${ip}`, 10)) {
    return Response.json({ error: "Too many uploads. Try again in a minute." }, { status: 429 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    if (!isAllowedMimeType(file.type)) {
      return Response.json({ error: "File type not allowed. Use JPG, PNG, or WEBP." }, { status: 400 });
    }

    if (!isAllowedFileSize(file.size)) {
      return Response.json({ error: "File must be between 1 byte and 10 MB." }, { status: 400 });
    }

    const safeName = sanitizeFilename(file.name);
    const blob = await put(`uploads/${Date.now()}-${safeName}`, file, {
      access: "public",
      contentType: file.type,
    });

    return Response.json({ url: blob.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
