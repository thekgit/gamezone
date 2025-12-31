import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export async function GET() {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    // 1) sessions (include status + timing fields)
    const { data: sessions, error: sErr } = await admin
      .from("sessions")
      .select("id, user_id, created_at, game_id, slot_id, status, start_time, end_time, started_at, ended_at, ends_at, players")
      .order("created_at", { ascending: false })
      .limit(200);

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

    const userIds = Array.from(new Set((sessions || []).map((s: any) => s.user_id).filter(Boolean)));
    const gameIds = Array.from(new Set((sessions || []).map((s: any) => s.game_id).filter(Boolean)));
    const slotIds = Array.from(new Set((sessions || []).map((s: any) => s.slot_id).filter(Boolean)));

    // 2) profiles
    let profilesMap: Record<string, any> = {};
    if (userIds.length) {
      const { data: profiles, error: pErr } = await admin
        .from("profiles")
        .select("user_id, full_name, phone, email")
        .in("user_id", userIds);

      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

      profilesMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
    }

    // 3) games
    let gamesMap: Record<string, any> = {};
    if (gameIds.length) {
      const { data: games, error: gErr } = await admin
        .from("games")
        .select("id, name, key")
        .in("id", gameIds);

      if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });

      gamesMap = Object.fromEntries((games || []).map((g: any) => [g.id, g]));
    }

    // 4) slots (optional)
    let slotsMap: Record<string, any> = {};
    if (slotIds.length) {
      const { data: slots, error: slErr } = await admin
        .from("slots")
        .select("id, start_time, end_time")
        .in("id", slotIds);

      if (slErr) return NextResponse.json({ error: slErr.message }, { status: 500 });

      slotsMap = Object.fromEntries((slots || []).map((sl: any) => [sl.id, sl]));
    }

    // 5) merge -> rows for UI
    const rows = (sessions || []).map((s: any) => {
      const p = profilesMap[s.user_id] || null;
      const g = gamesMap[s.game_id] || null;
      const sl = s.slot_id ? slotsMap[s.slot_id] || null : null;

      // slot start/end priority: slots table > session fields
      const slot_start = sl?.start_time || s.start_time || s.started_at || s.created_at || null;
      const slot_end = sl?.end_time || s.end_time || s.ended_at || s.ends_at || null;

      return {
        id: s.id,
        created_at: s.created_at,
        status: s.status || "active",

        full_name: p?.full_name ?? null,
        phone: p?.phone ?? null,
        email: p?.email ?? null,

        game_name: g?.name ?? null,
        slot_start,
        slot_end,
      };
    });

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}