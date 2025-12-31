export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export async function GET() {
  try {
    // ✅ admin cookie check
    if (!assertAdmin()) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    const admin = supabaseAdmin();

    // 1) get sessions (latest first)
    const { data: sessions, error: sErr } = await admin
      .from("sessions")
      .select("id, user_id, created_at, game_id, slot_id, start_time, end_time, started_at, ends_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (sErr) {
      return NextResponse.json(
        { error: sErr.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const userIds = Array.from(
      new Set((sessions || []).map((s: any) => s.user_id).filter(Boolean))
    );

    // 2) get matching profiles
    let profilesMap: Record<string, any> = {};
    if (userIds.length) {
      const { data: profiles, error: pErr } = await admin
        .from("profiles")
        .select("user_id, full_name, phone, email")
        .in("user_id", userIds);

      if (pErr) {
        return NextResponse.json(
          { error: pErr.message },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }

      profilesMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
    }

    // 3) get games for game_id -> name
    const gameIds = Array.from(
      new Set((sessions || []).map((s: any) => s.game_id).filter(Boolean))
    );

    let gamesMap: Record<string, any> = {};
    if (gameIds.length) {
      const { data: games, error: gErr } = await admin
        .from("games")
        .select("id, name, key")
        .in("id", gameIds);

      if (gErr) {
        return NextResponse.json(
          { error: gErr.message },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }

      gamesMap = Object.fromEntries((games || []).map((g: any) => [g.id, g]));
    }

    // 4) merge into rows the UI expects
    const rows = (sessions || []).map((s: any) => {
      const p = profilesMap[s.user_id] || null;
      const g = gamesMap[s.game_id] || null;

      // choose best start/end columns that exist in your schema
      const slot_start =
        s.start_time || s.started_at || s.created_at || null;

      const slot_end =
        s.end_time || s.ends_at || null;

      return {
        id: s.id,
        created_at: s.created_at,

        full_name: p?.full_name ?? null,
        phone: p?.phone ?? null,
        email: p?.email ?? null,

        game_name: g?.name ?? null,
        slot_start,
        slot_end,
      };
    });

    return NextResponse.json(
      { rows },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}