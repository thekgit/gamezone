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

    // slot_end comes from UI (because DB column name differs)
    const slot_end_from_ui = body?.slot_end ? String(body.slot_end) : null;

    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // ✅ Only fetch fields that definitely exist
    const { data: r, error: fetchErr } = await admin
      .from("sessions") // keep your actual table
      .select("id, exit_time, status")
      .eq("id", session_id)
      .single();

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!r) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    // if already ended, return ok (idempotent)
    if (r.exit_time || String(r.status || "").toLowerCase() === "ended") {
      return NextResponse.json({ ok: true, exit_time: r.exit_time }, { status: 200 });
    }

    const now = new Date();

    // ✅ Use slot_end from UI to apply your rule
    let exit = now;
    if (slot_end_from_ui) {
      const slotEnd = new Date(slot_end_from_ui);
      if (!isNaN(slotEnd.getTime())) {
        exit = now > slotEnd ? slotEnd : now; // min(now, slotEnd)
      }
    }

    const { error: updErr } = await admin
      .from("sessions")
      .update({
        exit_time: exit.toISOString(),
        status: "ended",
      })
      .eq("id", session_id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, exit_time: exit.toISOString() }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}