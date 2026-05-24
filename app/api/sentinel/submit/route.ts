import { NextRequest } from "next/server";
import { isAllowedBlobUrl, checkRateLimit } from "../../lib/validate";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(`sentinel:${ip}`, 5)) {
    return Response.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  try {
    const { imageUrl, originalUrl } = await request.json();

    if (!imageUrl || typeof imageUrl !== "string") {
      return Response.json({ error: "imageUrl is required" }, { status: 400 });
    }

    const body: Record<string, unknown> = {
      generated_image_url: imageUrl,
      task_type: "background-removal",
      task_description:
        "Remove the background from a product photo and crop to square 1:1 format for a Depop marketplace listing. The subject should be cleanly isolated on a transparent background.",
    };

    if (originalUrl && typeof originalUrl === "string" && isAllowedBlobUrl(originalUrl)) {
      body.reference_images = [
        {
          url: originalUrl,
          role: "subject",
          description: "Original photo before background removal.",
        },
      ];
    }

    const res = await fetch(
      "https://sentinel.runflow.io/api/v1/evaluate?sync=false",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.SENTINEL_API_KEY ?? process.env.RUNFLOW_API_KEY ?? "",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      return Response.json({ error: "Evaluation service unavailable" }, { status: 502 });
    }

    const data = await res.json();
    return Response.json({ evalId: data.eval_id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sentinel submit failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
