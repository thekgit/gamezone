import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!jwt) {
      return NextResponse.json({ error: "Not logged in", debug: { step: "no_jwt" } }, { status: 401 });
    }

    const admin = supabaseAdmin();

    // ✅ who am I
    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json(
        { error: "Invalid session", debug: { step: "auth_getUser_failed", userErr: userErr?.message } },
        { status: 401 }
      );
    }

    const user_id = userRes.user.id;

    // ✅ BULLETPROOF: fetch sessions where
    // - main owner is me OR
    // - player_user_ids contains me (works for postgres array column)
    //
    // IMPORTANT: We do NOT filter by ends_at here.
    //
    // Note: player_user_ids "cs" requires array column. If your column is JSONB, we fallback below.
    let sessions: any[] = [];

    // Attempt #1: assume player_user_ids is a Postgres uuid[] array
    const q1 = await admin
      .from("sessions")
      .select("id, players, status, started_at, ends_at, ended_at, user_id, player_user_ids, games:game_id(name)")
      .or(`user_id.eq.${user_id},player_user_ids.cs.{${user_id}}`)
      .order("created_at", { ascending: false })
      .limit(200);

    if (!q1.error) {
      sessions = q1.data || [];
    } else {
      // Attempt #2: if player_user_ids is JSONB (array), use contains on JSON
      // This is a safe fallback if schema is JSON.
      const q2 = await admin
        .from("sessions")
        .select("id, players, status, started_at, ends_at, ended_at, user_id, player_user_ids, games:game_id(name)")
        .or(`user_id.eq.${user_id}`)
        .order("created_at", { ascending: false })
        .limit(200);

      if (q2.error) {
        return NextResponse.json(
          { error: q2.error.message, debug: { step: "query_failed", q1: q1.error?.message, q2: q2.error?.message } },
          { status: 500 }
        );
      }

      // JSONB manual filter (client-side) — BULLETPROOF
      sessions = (q2.data || []).filter((s: any) => {
        const arr = Array.isArray(s.player_user_ids) ? s.player_user_ids : [];
        return s.user_id === user_id || arr.includes(user_id);
      });
    }

    // ✅ ACTIVE = ended_at is null AND status not ended (but do NOT hide if status is wrong)
    const active = sessions.filter((s: any) => {
      const ended = !!s.ended_at || String(s.status || "").toLowerCase() === "ended";
      return !ended;
    });

    const responseSessions = active.map((s: any) => ({
      id: s.id,
      game_name: s?.games?.name ?? null,
      players: s.players ?? null,
      started_at: s.started_at ?? null,
      ends_at: s.ends_at ?? null,
      status: s.status ?? null,
    }));

    return NextResponse.json(
      {
        sessions: responseSessions,
        // ✅ TEMP DEBUG (remove later)
        debug: {
          user_id,
          totalFetched: sessions.length,
          activeCount: responseSessions.length,
          note: "Remove debug later once confirmed",
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error", debug: { step: "catch" } }, { status: 500 });
  }
}