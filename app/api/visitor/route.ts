import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

type SessionRow = {
  id: string;
  game_id: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
  created_at: string | null;
  started_at: string | null;
  ended_at: string | null;

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

    // Get latest sessions (ended + active)
    const { data: sessions, error: sErr } = await admin
      .from("sessions")
      .select(
        "id, game_id, status, start_time, end_time, created_at, started_at, ended_at, visitor_name, visitor_phone, visitor_email"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

    const safeSessions = (sessions || []) as SessionRow[];

    // Load game names
    const gameIds = Array.from(
      new Set(
        safeSessions
          .map((s) => s.game_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
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

    // Normalize response for UI
    const rows = safeSessions.map((s) => {
      const startIso = s.start_time || s.started_at || s.created_at;
      const endIso = s.end_time; // keep fixed 1-hour slot end_time
      return {
        id: s.id,
        status: s.status,
        timestamp: s.created_at,
        name: s.visitor_name || "",
        phone: s.visitor_phone || "",
        email: s.visitor_email || "",
        game: gameMap.get(s.game_id) || "Unknown",
        start_time: startIso,
        end_time: endIso,
        exit_time: s.ended_at, // ✅ this is the exact scan time
      };
    });

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}