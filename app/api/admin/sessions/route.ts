import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

type SessionRow = {
  id: string;
  user_id: string;
  created_at: string | null;

  game_id: string | null;
  slot_id: string | null;

  start_time: string | null;
  end_time: string | null;

  status: string | null;
  ended_at: string | null; // ✅ exit scan time

  visitor_name: string | null;
  visitor_phone: string | null;
  visitor_email: string | null;
};

export async function GET() {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    const { data: sessions, error: sErr } = await admin
      .from("sessions")
      .select(
        "id, user_id, created_at, game_id, slot_id, start_time, end_time, status, ended_at, visitor_name, visitor_phone, visitor_email"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

    const safe = (sessions || []) as SessionRow[];

    // ✅ games lookup
    const gameIds = Array.from(
      new Set(
        safe
          .map((s) => s.game_id)
          .filter((x): x is string => typeof x === "string" && x.length > 0)
      )
    );

    let gameMap = new Map<string, string>();
    if (gameIds.length) {
      const { data: games, error: gErr } = await admin
        .from("games")
        .select("id, name")
        .in("id", gameIds);

      if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });

      gameMap = new Map((games || []).map((g: any) => [g.id, g.name]));
    }

    const rows = safe.map((s) => ({
      id: s.id,
      created_at: s.created_at,

      // ✅ visitor info (what you want in table)
      full_name: s.visitor_name,
      phone: s.visitor_phone,
      email: s.visitor_email,

      // ✅ game
      game_name: s.game_id ? gameMap.get(s.game_id) || "Unknown" : "Unknown",

      // ✅ slot (fixed 1 hour window)
      slot_start: s.start_time,
      slot_end: s.end_time,

      // ✅ IMPORTANT for UI rules
      status: s.status,
      exit_time: s.ended_at, // ✅ this is the scan time
    }));

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}