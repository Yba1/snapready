import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ runId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { runId } = await ctx.params;

    const res = await fetch(`https://api.runflow.io/v1/runs/${runId}`, {
      headers: {
        Authorization: `Bearer ${process.env.RUNFLOW_API_KEY}`,
      },
    });

    if (!res.ok) {
      return Response.json({ error: "Failed to fetch run" }, { status: res.status });
    }

    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Poll failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
