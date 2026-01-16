import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAssistant } from "@/lib/assertAssistant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function maskName(name: string | null) {
  const n = String(name || "").trim();
  if (!n) return "Guest";
  if (n.length <= 2) return n[0] + "*";
  return n.slice(0, 2) + "*".repeat(Math.min(6, n.length - 2));
}

export async function GET() {
  try {
    if (!(await assertAssistant())) {
      return NextResponse.json({ error: "Unauthorized", rows: [] }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const nowIso = new Date().toISOString();

    // ✅ ONLY ACTIVE sessions; ended ones don't show for assistant
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
        visitor_name,
        games:game_id ( name )
      `
      )
      .or("status.eq.active,status.is.null")
      .is("ended_at", null)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ error: error.message, rows: [] }, { status: 500 });
    }

    const rows = (data || []).map((s: any) => ({
      id: s.id,
      created_at: s.created_at,
      status: s.status ?? "active",
      players: s.players ?? null,
      slot_start: s.started_at ?? null,
      slot_end: s.ends_at ?? null,
      exit_time: s.ended_at ?? null,
      game_name: s?.games?.name ?? null,

      // ✅ masked (no phone/email here)
      full_name: maskName(s.visitor_name ?? null),
      phone: null,
      email: null,
    }));

    return NextResponse.json({ rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error", rows: [] },
      { status: 500 }
    );
  }
}