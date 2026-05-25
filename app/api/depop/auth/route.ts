import { NextRequest } from "next/server";
import { checkRateLimit } from "../../lib/validate";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(`depop-auth:${ip}`, 5)) {
    return Response.json({ error: "Too many attempts" }, { status: 429 });
  }

  try {
    const { username, password } = await request.json();
    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return Response.json({ error: "Username and password required" }, { status: 400 });
    }

    const res = await fetch("https://api.depop.com/api/v1/oauth/access_token/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Depop/2.160 CFNetwork/1492.0.1 Darwin/23.3.0",
        "Accept": "application/json",
      },
      body: new URLSearchParams({
        grant_type: "password",
        username,
        password,
        client_id: "3FzRGLGXPH2p5VGEANGfJhLBBhcKWyVBNc",
      }).toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        return Response.json({ error: "Incorrect username or password" }, { status: 401 });
      }
      return Response.json({ error: `Depop auth failed (${res.status}): ${text.slice(0, 120)}` }, { status: 502 });
    }

    const data = await res.json();
    if (!data.access_token) {
      return Response.json({ error: "No token returned from Depop" }, { status: 502 });
    }

    return Response.json({ token: data.access_token });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Auth failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
