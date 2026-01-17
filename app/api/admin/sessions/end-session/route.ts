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

    // If already ended, just return ok
    const { data: s, error: sErr } = await admin
      .from("sessions")
      .select("id, ended_at, status")
      .eq("id", session_id)
      .single();

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const ended = !!s.ended_at || String(s.status || "").toLowerCase() === "ended";
    if (ended) {
      return NextResponse.json({ ok: true, ended_at: s.ended_at }, { status: 200 });
    }

    // ✅ IMPORTANT: use the click time ALWAYS
    const nowIso = new Date().toISOString();

    const { error: updErr } = await admin
      .from("sessions")
      .update({ ended_at: nowIso, status: "ended" })
      .eq("id", session_id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, ended_at: nowIso }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}