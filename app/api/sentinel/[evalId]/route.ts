import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ evalId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { evalId } = await ctx.params;

    const res = await fetch(
      `https://sentinel.runflow.io/api/v1/evaluate/${evalId}`,
      {
        headers: {
          "x-api-key": process.env.RUNFLOW_API_KEY ?? "",
        },
      }
    );

    if (!res.ok) {
      return Response.json({ error: "Sentinel poll failed" }, { status: res.status });
    }

    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Poll failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
