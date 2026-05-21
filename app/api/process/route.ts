import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return Response.json({ error: "imageUrl is required" }, { status: 400 });
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
          input: {
            image_url: imageUrl,
            config: { aspect_ratio: "1:1" },
          },
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      return Response.json({ error: `Runflow error: ${body}` }, { status: res.status });
    }

    const data = await res.json();
    return Response.json({ runId: data.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start job";
    return Response.json({ error: message }, { status: 500 });
  }
}
