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

    const { data: s, error } = await admin
      .from("sessions")
      .select("id, ends_at, ended_at, status")
      .eq("id", session_id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    if (s.ended_at || String(s.status || "").toLowerCase() === "ended") {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const now = new Date();
    const slotEnd = s.ends_at ? new Date(s.ends_at) : null;
    const exit =
      slotEnd && !isNaN(slotEnd.getTime()) && now > slotEnd ? slotEnd : now;

    const { error: updErr } = await admin
      .from("sessions")
      .update({ ended_at: exit.toISOString(), status: "ended" })
      .eq("id", session_id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}