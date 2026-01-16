import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAssistant } from "@/lib/assertAssistant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    if (!(await assertAssistant())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const session_id = String(body?.session_id || "").trim();
    if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

    const admin = supabaseAdmin();

    const { data: s, error: fetchErr } = await admin
      .from("sessions")
      .select("id, status, ends_at, ended_at")
      .eq("id", session_id)
      .single();

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const st = String(s.status || "").toLowerCase();
    if (s.ended_at || st === "ended" || st === "completed") {
      return NextResponse.json({ ok: true, ended_at: s.ended_at }, { status: 200 });
    }

    const now = new Date();
    let endAt = now;

    if (s.ends_at) {
      const slotEnd = new Date(String(s.ends_at));
      if (!isNaN(slotEnd.getTime())) endAt = now > slotEnd ? slotEnd : now;
    }

    const { error: updErr } = await admin
      .from("sessions")
      .update({ ended_at: endAt.toISOString(), status: "ended" })
      .eq("id", session_id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, ended_at: endAt.toISOString() }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}