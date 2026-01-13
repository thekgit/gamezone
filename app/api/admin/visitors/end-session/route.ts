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

    // 1) Load sessions WITHOUT any relationship joins (prevents schema-cache FK errors)
    const { data: sessions, error: sErr } = await admin
      .from("sessions")
      .select("*")
      .order("created_at", { ascending: false });

    if (sErr) {
      return NextResponse.json({ error: sErr.message, rows: [] }, { status: 500 });
    }

    const s = sessions ?? [];

    // Collect user_ids and game_ids (only if present)
    const userIds = Array.from(
      new Set(
        s.map((x: any) => x.user_id).filter(Boolean)
      )
    );

    const gameIds = Array.from(
      new Set(
        s.map((x: any) => x.game_id).filter(Boolean)
      )
    );

    // 2) Load profiles (no relationship join; simple IN query)
    const profilesMap = new Map<string, any>();
    if (userIds.length > 0) {
      const { data: проф, error: pErr } = await admin
        .from("profiles")
        .select("user_id, full_name, phone, email")
        .in("user_id", userIds);

      if (pErr) {
        return NextResponse.json({ error: pErr.message, rows: [] }, { status: 500 });
      }

      for (const p of проф ?? []) profilesMap.set(p.user_id, p);
    }

    // 3) Load games (no relationship join; simple IN query)
    const gamesMap = new Map<string, any>();
    if (gameIds.length > 0) {
      const { data: g, error: gErr } = await admin
        .from("games")
        .select("id, name")
        .in("id", gameIds);

      if (gErr) {
        return NextResponse.json({ error: gErr.message, rows: [] }, { status: 500 });
      }

      for (const game of g ?? []) gamesMap.set(game.id, game);
    }

    // 4) Shape rows EXACTLY how your AdminDashboardClient expects
    const rows = s.map((x: any) => {
      const p = x.user_id ? profilesMap.get(x.user_id) : null;
      const g = x.game_id ? gamesMap.get(x.game_id) : null;

      return {
        id: x.id,
        created_at: x.created_at ?? null,

        // prefer session fields if they exist, otherwise take from profiles
        full_name: x.full_name ?? p?.full_name ?? null,
        phone: x.phone ?? p?.phone ?? null,
        email: x.email ?? p?.email ?? null,

        game_name: x.game_name ?? g?.name ?? null,
        players: typeof x.players === "number" ? x.players : x.players ?? null,

        slot_start: x.slot_start ?? null,
        slot_end: x.slot_end ?? null,

        status: x.status ?? x.state ?? x.session_status ?? null,

        // ✅ IMPORTANT: your DB uses ended_at (your other routes already do this)
        exit_time: x.ended_at ?? null,
      };
    });

    return NextResponse.json({ rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error", rows: [] },
      { status: 500 }
    );
  }
}