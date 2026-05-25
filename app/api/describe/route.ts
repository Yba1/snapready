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
      max_tokens: 512,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          {
            type: "text",
            text: `You are a Depop listing expert. Analyse this clothing/fashion item and return ONLY valid JSON — no markdown, no explanation — with these exact fields:
- title: string (max 50 chars, catchy, include brand if visible)
- description: string (2–3 sentences: condition, style, fit hint, why it's worth buying)
- hashtags: string[] (exactly 6 relevant hashtags, no # symbol)`,
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
