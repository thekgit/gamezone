import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized", rows: [] }, { status: 401 });
    }

    const admin = supabaseAdmin();

    const { data, error } = await admin
      .from("sessions")
      .select(
        `id, created_at, user_id, players, status, started_at, ends_at, ended_at,
         visitor_name, visitor_phone, visitor_email, player_user_ids,
         games:game_id(name)`
      )
      .order("created_at", { ascending: false })
      .limit(9999);

    if (error) return NextResponse.json({ error: error.message, rows: [] }, { status: 500 });

    const rows = (data || []).map((s: any) => ({
      id: s.id,
      created_at: s.created_at,
      full_name: s.visitor_name ?? null,
      phone: s.visitor_phone ?? null,
      email: s.visitor_email ?? null,
      game_name: s?.games?.name ?? null,
      players: s.players ?? null,
      slot_start: s.started_at ?? null,
      slot_end: s.ends_at ?? null,
      exit_time: s.ended_at ?? null,
      status: s.status ?? null,
      player_user_ids: Array.isArray(s.player_user_ids) ? s.player_user_ids : [],
      user_id: s.user_id ?? null,
    }));

    return NextResponse.json({ rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error", rows: [] }, { status: 500 });
  }
}