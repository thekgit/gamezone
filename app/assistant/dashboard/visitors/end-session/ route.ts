import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAssistant } from "@/lib/assertAssistant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    if (!assertAssistant()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const session_id = String(body?.session_id || "").trim();
    if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

    const admin = supabaseAdmin();

    // fetch session
    const { data: s, error: sErr } = await admin
      .from("sessions")
      .select("id, started_at, ends_at, ended_at, status")
      .eq("id", session_id)
      .maybeSingle();

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    if (!s?.id) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (s.ended_at) return NextResponse.json({ ok: true, alreadyEnded: true }, { status: 200 });

    const now = new Date();
    const nowIso = now.toISOString();

    // if slot already passed, end at slot_end else end now
    const slotEndIso = s.ends_at ? new Date(s.ends_at).toISOString() : null;
    const endTimeIso = slotEndIso && new Date(slotEndIso) < now ? slotEndIso : nowIso;

    const { error: updErr } = await admin
      .from("sessions")
      .update({ ended_at: endTimeIso, status: "ended" })
      .eq("id", session_id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}