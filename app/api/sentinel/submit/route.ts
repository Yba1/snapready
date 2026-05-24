import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, originalUrl } = await request.json();

    if (!imageUrl) {
      return Response.json({ error: "imageUrl is required" }, { status: 400 });
    }

    const body: Record<string, unknown> = {
      generated_image_url: imageUrl,
      task_type: "background-removal",
      task_description:
        "Remove the background from a product photo and crop to square 1:1 format for a Depop marketplace listing. The subject should be cleanly isolated on a transparent background.",
    };

    if (originalUrl) {
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
      const text = await res.text();
      return Response.json({ error: `Sentinel error: ${text}` }, { status: res.status });
    }

    const data = await res.json();
    return Response.json({ evalId: data.eval_id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sentinel submit failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
