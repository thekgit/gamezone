import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export async function GET() {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    // 1) Sessions (ONLY ACTIVE) + remove broken rows
    const { data: sessions, error: sErr } = await admin
      .from("sessions")
      .select("id, user_id, created_at, game_id, slot_id, status")
      .eq("status", "active")
      .not("game_id", "is", null)
      .not("slot_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

    const safeSessions = sessions || [];

    const userIds = Array.from(new Set(safeSessions.map((s) => s.user_id).filter(Boolean)));
    const gameIds = Array.from(new Set(safeSessions.map((s) => s.game_id).filter(Boolean)));
    const slotIds = Array.from(new Set(safeSessions.map((s) => s.slot_id).filter(Boolean)));

    // 2) Profiles map
    let profilesMap: Record<string, any> = {};
    if (userIds.length) {
      const { data: profiles, error: pErr } = await admin
        .from("profiles")
        .select("user_id, full_name, phone, email")
        .in("user_id", userIds);

      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

      profilesMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));
    }

    // 3) Games map
    let gamesMap: Record<string, any> = {};
    if (gameIds.length) {
      const { data: games, error: gErr } = await admin
        .from("games")
        .select("id, name")
        .in("id", gameIds);

      if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });

      gamesMap = Object.fromEntries((games || []).map((g) => [g.id, g]));
    }

    // 4) Slots map
    let slotsMap: Record<string, any> = {};
    if (slotIds.length) {
      const { data: slots, error: slErr } = await admin
        .from("slots")
        .select("id, start_time, end_time")
        .in("id", slotIds);

      if (slErr) return NextResponse.json({ error: slErr.message }, { status: 500 });

      slotsMap = Object.fromEntries((slots || []).map((s) => [s.id, s]));
    }

    // 5) Merge into UI rows
    const rows = safeSessions.map((s) => {
      const p = profilesMap[s.user_id] || null;
      const g = gamesMap[s.game_id] || null;
      const sl = slotsMap[s.slot_id] || null;

      return {
        id: s.id,
        created_at: s.created_at,

        full_name: p?.full_name ?? null,
        phone: p?.phone ?? null,
        email: p?.email ?? null,

        game_name: g?.name ?? null,
        slot_start: sl?.start_time ?? null,
        slot_end: sl?.end_time ?? null,
      };
    });

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}