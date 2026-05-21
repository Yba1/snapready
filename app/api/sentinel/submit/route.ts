import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return Response.json({ error: "imageUrl is required" }, { status: 400 });
    }

    const res = await fetch(
      "https://sentinel.runflow.io/api/v1/evaluate?sync=false",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.RUNFLOW_API_KEY ?? "",
        },
        body: JSON.stringify({
          generated_image_url: imageUrl,
          task_type: "product_photo",
          task_description:
            "Product photo with background removed, cropped to square 1:1 format for a marketplace listing.",
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      return Response.json({ error: `Sentinel error: ${body}` }, { status: res.status });
    }

    const data = await res.json();
    return Response.json({ evalId: data.eval_id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sentinel submit failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
