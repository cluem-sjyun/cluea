import { stopCurrentChild } from "../user-creator-run/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const ok = await stopCurrentChild();
  return new Response(JSON.stringify({ ok }), {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "application/json" },
  });
}
