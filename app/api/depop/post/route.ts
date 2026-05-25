import { NextRequest } from "next/server";
import { checkRateLimit } from "../../lib/validate";

const CONDITION_IDS: Record<string, number> = {
  "New with tags": 1,
  "Like new": 2,
  "Good": 3,
  "Fair": 4,
};

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(`depop-post:${ip}`, 10)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { token, imageUrl, title, description, hashtags, price, condition } = await request.json();

    if (!token || !imageUrl || !title || !description || !price) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Step 1: fetch the processed image and upload it to Depop
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error("Could not fetch processed image");
    const imgBuffer = await imgRes.arrayBuffer();
    const imgBlob = new Blob([imgBuffer], { type: "image/png" });

    const imgForm = new FormData();
    imgForm.append("photo", imgBlob, "photo.png");

    const uploadRes = await fetch("https://api.depop.com/api/v2/images/", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: imgForm,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => "");
      throw new Error(`Image upload failed (${uploadRes.status}): ${text.slice(0, 120)}`);
    }

    const uploadData = await uploadRes.json();
    const imageId: string = uploadData.id ?? uploadData.data?.id;
    if (!imageId) throw new Error("No image ID returned from Depop");

    // Step 2: create the draft listing
    const fullDescription = [
      description,
      hashtags?.length ? hashtags.map((t: string) => `#${t}`).join(" ") : "",
    ].filter(Boolean).join("\n\n");

    const listingRes = await fetch("https://api.depop.com/api/v2/products/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        description: fullDescription,
        price: Math.round(Number(price) * 100), // pence
        condition_id: CONDITION_IDS[condition] ?? 3,
        country_code: "GB",
        pictures: [imageId],
        status: "draft",
      }),
    });

    if (!listingRes.ok) {
      const text = await listingRes.text().catch(() => "");
      throw new Error(`Listing creation failed (${listingRes.status}): ${text.slice(0, 160)}`);
    }

    const listingData = await listingRes.json();
    const listingId = listingData.id ?? listingData.data?.id;

    return Response.json({
      success: true,
      listingId,
      editUrl: listingId ? `https://www.depop.com/products/${listingId}/edit/` : "https://www.depop.com",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Post failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
