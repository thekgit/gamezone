import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const session_id = String(body?.session_id || "").trim();

    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // 1) fetch session row (need slot_end + current exit_time)
    const { data: sess, error: fetchErr } = await admin
      .from("visitor_sessions") // ⚠️ change to your actual table name
      .select("id, exit_time, slot_end")
      .eq("id", session_id)
      .single();

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!sess) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    // if already ended, do nothing (idempotent)
    if (sess.exit_time) {
      return NextResponse.json({ ok: true, exit_time: sess.exit_time }, { status: 200 });
    }

    // 2) compute exit_time = min(now, slot_end)
    const now = new Date();
    const slotEnd = sess.slot_end ? new Date(sess.slot_end) : null;

    const exit = slotEnd && now > slotEnd ? slotEnd : now;

    // 3) update exit_time + status
    const { error: updErr } = await admin
      .from("visitor_sessions") // ⚠️ change to your actual table name
      .update({
        exit_time: exit.toISOString(),
        status: "completed", // ⚠️ change if you use a different field/value
      })
      .eq("id", session_id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, exit_time: exit.toISOString() }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}