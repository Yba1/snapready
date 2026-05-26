import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest } from "next/server";
import { checkRateLimit } from "../lib/validate";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody;

  // Only rate-limit the token request (completion webhook comes from Vercel's servers)
  if (body.type === "blob.generate-client-token") {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (!checkRateLimit(`upload:${ip}`, 10)) {
      return Response.json({ error: "Too many uploads. Try again in a minute." }, { status: 429 });
    }
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        maximumSizeInBytes: 10 * 1024 * 1024,
      }),
      onUploadCompleted: async () => {},
    });
    return Response.json(jsonResponse);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 400 });
  }
}
