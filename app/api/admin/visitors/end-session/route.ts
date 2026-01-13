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

    // ✅ your sessions API uses /api/admin/sessions, so table is almost certainly `sessions`
    // If your actual table name differs, replace "sessions" with it.
    const { data: r, error: fetchErr } = await admin
      .from("sessions")
      .select("id, slot_end, exit_time, status")
      .eq("id", session_id)
      .single();

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!r) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    // If already ended, return ok (idempotent)
    if (r.exit_time || (String(r.status || "").toLowerCase() === "ended")) {
      return NextResponse.json({ ok: true, exit_time: r.exit_time }, { status: 200 });
    }

    const now = new Date();
    const slotEnd = r.slot_end ? new Date(r.slot_end) : null;

    // exit_time rule: min(now, slot_end)
    const exit = slotEnd && now > slotEnd ? slotEnd : now;

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