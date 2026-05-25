import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "../lib/validate";

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(`describe:${ip}`, 5)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { imageUrl } = await request.json();
    if (!imageUrl || typeof imageUrl !== "string") {
      return Response.json({ error: "imageUrl is required" }, { status: 400 });
    }
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== "https:") {
      return Response.json({ error: "Invalid image URL" }, { status: 400 });
    }

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          {
            type: "text",
            text: `You are a Depop resale expert. Analyse this clothing item and return ONLY valid JSON — no markdown, no explanation:
{
  "title": "string (max 50 chars, catchy, include brand if visible)",
  "description": "string (2-3 sentences: style, vibe, fit — no measurements here)",
  "hashtags": ["string"] (exactly 6 hashtags, no # symbol),
  "price_low": number (GBP realistic Depop low end),
  "price_high": number (GBP realistic Depop high end),
  "price_recommended": number (GBP sweet spot for fast sale),
  "condition": "New with tags" or "Like new" or "Good" or "Fair",
  "visible_defects": "string describing any visible issues, or null if none",
  "measurements": {
    "chest_cm": number or null,
    "length_cm": number or null,
    "sleeve_cm": number or null,
    "notes": "string — caveats, e.g. estimated from frame"
  }
}`,
          },
        ],
      }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
    const json = raw.replace(/```(?:json)?\n?|\n?```/g, "").trim();
    const listing = JSON.parse(json);
    return Response.json(listing);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate listing";
    return Response.json({ error: message }, { status: 500 });
  }
}
