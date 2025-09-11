import { stopCurrentChild } from "../user-deleter-run/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const ok = await stopCurrentChild();
    return new Response(JSON.stringify({ ok }), {
      status: ok ? 200 : 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
