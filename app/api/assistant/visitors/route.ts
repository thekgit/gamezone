import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAssistant } from "@/lib/assertAssistant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    if (!assertAssistant()) {
      return NextResponse.json({ error: "Unauthorized", rows: [] }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const nowIso = new Date().toISOString();

    // ✅ Assistant sees ONLY active sessions (ended sessions disappear)
    const { data, error } = await admin
      .from("sessions")
      .select(
        `
        id,
        created_at,
        status,
        players,
        started_at,
        ends_at,
        ended_at,
        games:game_id ( name )
      `
      )
      .is("ended_at", null)
      .or("status.eq.active,status.is.null")
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`) // keep "currently running" sessions
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) return NextResponse.json({ error: error.message, rows: [] }, { status: 500 });

    // ✅ No personal details returned
    const rows = (data || []).map((s: any) => ({
      id: s.id,
      created_at: s.created_at,
      game_name: s?.games?.name ?? null,
      players: s.players ?? null,
      slot_start: s.started_at ?? null,
      slot_end: s.ends_at ?? null,
      status: s.status ?? null,
      exit_time: s.ended_at ?? null,
    }));

    return NextResponse.json({ rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error", rows: [] }, { status: 500 });
  }
}