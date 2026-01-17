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
    const clickedAt = new Date().toISOString();

    // Read once
    const { data: s0, error: e0 } = await admin
      .from("sessions")
      .select("id, status, ended_at, closed_at")
      .eq("id", session_id)
      .single();

    if (e0) return NextResponse.json({ error: e0.message }, { status: 500 });
    if (!s0) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const st0 = String(s0.status || "").toLowerCase();
    if (s0.ended_at || s0.closed_at || st0 === "ended" || st0 === "completed") {
      return NextResponse.json(
        { ok: true, ended_at: s0.ended_at ?? null, closed_at: s0.closed_at ?? null, already_ended: true },
        { status: 200 }
      );
    }

    // ✅ Force "click time" into a dedicated column no trigger should touch
    const { error: u1 } = await admin
      .from("sessions")
      .update({
        closed_at: clickedAt,  // <-- the important one
        ended_at: clickedAt,   // keep this too (even if trigger overwrites it)
        status: "ended",
      })
      .eq("id", session_id);

    if (u1) return NextResponse.json({ error: u1.message }, { status: 500 });

    // Re-read to verify what actually stored
    const { data: s1, error: e1 } = await admin
      .from("sessions")
      .select("id, status, ended_at, closed_at, ends_at")
      .eq("id", session_id)
      .single();

    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

    return NextResponse.json(
      {
        ok: true,
        clicked_at: clickedAt,
        // UI should display closed_at FIRST
        closed_at: s1?.closed_at ?? clickedAt,
        ended_at: s1?.ended_at ?? null,
        ends_at: s1?.ends_at ?? null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}