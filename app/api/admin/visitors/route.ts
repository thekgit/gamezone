import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export async function GET() {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    const { data: sessions, error: sErr } = await admin
      .from("sessions")
      .select(
        "id, status, game_id, start_time, end_time, created_at, visitor_name, visitor_phone, visitor_email, ended_at"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

    const safeSessions = sessions || [];

    // Collect game ids safely
    const gameIds = Array.from(
      new Set(
        safeSessions
          .map((s: any) => s.game_id)
          .filter((id: any): id is string => typeof id === "string" && id.length > 0)
      )
    );

    let gameMap = new Map<string, string>();
    if (gameIds.length > 0) {
      const { data: games, error: gErr } = await admin
        .from("games")
        .select("id, name")
        .in("id", gameIds);

      if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });

      gameMap = new Map((games || []).map((g: any) => [g.id, g.name]));
    }

    const rows = safeSessions.map((s: any) => ({
      id: s.id,
      status: s.status,                 // ✅ needed to disable button
      timestamp: s.created_at,
      name: s.visitor_name || "",
      phone: s.visitor_phone || "",
      email: s.visitor_email || "",
      game: gameMap.get(s.game_id) || "Unknown",
      start_time: s.start_time,
      end_time: s.end_time,             // ✅ keeps 1-hour slot fixed
      exit_time: s.ended_at,            // ✅ exact QR scan time
    }));

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}