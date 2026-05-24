import { NextRequest } from "next/server";
import { isAllowedBlobUrl, checkRateLimit } from "../lib/validate";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(`process:${ip}`, 5)) {
    return Response.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  try {
    const { imageUrl } = await request.json();

    if (!imageUrl || typeof imageUrl !== "string") {
      return Response.json({ error: "imageUrl is required" }, { status: 400 });
    }

    if (!isAllowedBlobUrl(imageUrl)) {
      return Response.json({ error: "Invalid image URL" }, { status: 400 });
    }

    const res = await fetch(
      "https://api.runflow.io/v1/models/runflow/background-removal/runs",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RUNFLOW_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: { image_url: imageUrl, config: { aspect_ratio: "1:1" } },
        }),
      }
    );

    if (!res.ok) {
      return Response.json({ error: "Processing service unavailable" }, { status: 502 });
    }

    const data = await res.json();
    return Response.json({ runId: data.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start job";
    return Response.json({ error: message }, { status: 500 });
  }
}
