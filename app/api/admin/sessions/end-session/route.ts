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
    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // (optional safety) check session exists
    const { data: s, error: fetchErr } = await admin
      .from("sessions")
      .select("id, ended_at, status")
      .eq("id", session_id)
      .single();

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    // ✅ If already ended, just return ok (idempotent)
    const st = String(s.status || "").toLowerCase();
    if (s.ended_at || st === "ended" || st === "completed") {
      return NextResponse.json({ ok: true, ended_at: s.ended_at }, { status: 200 });
    }

    // ✅ IMPORTANT: ALWAYS use click time (NOW)
    const nowIso = new Date().toISOString();

    const { error: updErr } = await admin
      .from("sessions")
      .update({ ended_at: nowIso, status: "ended" })
      .eq("id", session_id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, ended_at: nowIso }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}