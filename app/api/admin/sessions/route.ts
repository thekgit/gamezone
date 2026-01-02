import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    // sessions + games name (players INCLUDED)
    const { data, error } = await admin
      .from("sessions")
      .select(
        `
        id,
        created_at,
        status,
        exit_time,
        started_at,
        ends_at,
        players,
        visitor_name,
        visitor_phone,
        visitor_email,
        game_id,
        games:games ( name )
      `
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data || []).map((s: any) => ({
      id: s.id,
      created_at: s.created_at,

      full_name: s.visitor_name ?? null,
      phone: s.visitor_phone ?? null,
      email: s.visitor_email ?? null,

      game_name: s.games?.name ?? null,

      players: typeof s.players === "number" ? s.players : null,

      slot_start: s.started_at ?? null,
      slot_end: s.ends_at ?? null,

      status: s.status ?? null,
      exit_time: s.exit_time ?? null,
    }));

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}