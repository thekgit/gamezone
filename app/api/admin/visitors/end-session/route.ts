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
    if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

    const admin = supabaseAdmin();
    const clickedAt = new Date().toISOString();

    // ✅ HARD VERIFY: check if column exists by attempting update
    const { error: updErr } = await admin
      .from("sessions")
      .update({
        closed_at: clickedAt,
        ended_at: clickedAt,
        status: "ended",
      })
      .eq("id", session_id);

    if (updErr) {
      return NextResponse.json(
        {
          error: "UPDATE FAILED",
          debug_route: "ADMIN_END_SESSION_ROUTE_V2_RUNNING",
          message: updErr.message,
          clickedAt,
        },
        { status: 500 }
      );
    }

    // ✅ Re-read immediately (this reveals if DB overwrote it)
    const { data: s1, error: rErr } = await admin
      .from("sessions")
      .select("id, status, ended_at, closed_at, ends_at")
      .eq("id", session_id)
      .single();

    if (rErr) {
      return NextResponse.json(
        { error: rErr.message, debug_route: "ADMIN_END_SESSION_ROUTE_V2_RUNNING" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        debug_route: "ADMIN_END_SESSION_ROUTE_V2_RUNNING",
        clickedAt,
        ended_at_after: s1?.ended_at ?? null,
        closed_at_after: s1?.closed_at ?? null,
        ends_at: s1?.ends_at ?? null,
        status_after: s1?.status ?? null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error", debug_route: "ADMIN_END_SESSION_ROUTE_V2_RUNNING" },
      { status: 500 }
    );
  }
}