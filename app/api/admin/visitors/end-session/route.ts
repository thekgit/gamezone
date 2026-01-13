import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const session_id = String(body?.session_id || "").trim();

    // slot_end comes from UI (since sessions.slot_end may not exist in DB)
    const slot_end_from_ui = body?.slot_end ? String(body.slot_end) : null;

    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // ✅ REAL DB COLUMN: ended_at (NOT exit_time)
    const { data: r, error: fetchErr } = await admin
      .from("sessions")
      .select("id, ended_at, status")
      .eq("id", session_id)
      .single();

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!r) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const st = String(r.status || "").toLowerCase();

    // ✅ already ended? idempotent
    if (r.ended_at || st === "ended" || st === "completed") {
      return NextResponse.json(
        { ok: true, exit_time: r.ended_at ?? null },
        { status: 200 }
      );
    }

    // Compute exit_time = min(now, slot_end)
    const now = new Date();
    let exit = now;

    if (slot_end_from_ui) {
      const slotEnd = new Date(slot_end_from_ui);
      if (!isNaN(slotEnd.getTime())) {
        exit = now > slotEnd ? slotEnd : now;
      }
    }

    // ✅ update REAL DB column ended_at
    const { error: updErr } = await admin
      .from("sessions")
      .update({
        ended_at: exit.toISOString(),
        status: "ended",
      })
      .eq("id", session_id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json(
      { ok: true, exit_time: exit.toISOString() }, // keep API response name as exit_time for UI
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}