import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

type SessionRow = {
  id: string;
  user_id: string;
  game_id: string;
  slot_id: string | null;

  created_at: string;

  status: string;
  exit_token: string | null;

  start_time: string | null;
  end_time: string | null;

  started_at: string | null;
  ended_at: string | null;

  ends_at: string | null;
  players: number | null;
};

export async function GET() {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    // ✅ Fetch sessions including "ended markers" + status
    const { data: sessions, error: sErr } = await admin
      .from("sessions")
      .select(
        "id, user_id, game_id, slot_id, created_at, status, exit_token, start_time, end_time, started_at, ended_at, ends_at, players"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

    const safeSessions = (sessions || []) as SessionRow[];

    const userIds = Array.from(
      new Set(safeSessions.map((s) => s.user_id).filter(Boolean))
    );
    const gameIds = Array.from(
      new Set(safeSessions.map((s) => s.game_id).filter(Boolean))
    );
    const slotIds = Array.from(
      new Set(
        safeSessions
          .map((s) => s.slot_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );

    // Profiles
    const { data: profiles } = userIds.length
      ? await admin
          .from("profiles")
          .select("user_id, full_name, phone, email")
          .in("user_id", userIds)
      : { data: [] as any[] };

    // Games
    const { data: games } = gameIds.length
      ? await admin.from("games").select("id, name, key").in("id", gameIds)
      : { data: [] as any[] };

    // Slots (optional)
    const { data: slots } = slotIds.length
      ? await admin
          .from("slots")
          .select("id, start_time, end_time")
          .in("id", slotIds)
      : { data: [] as any[] };

    const profileByUser = new Map(
      (profiles || []).map((p: any) => [p.user_id, p])
    );
    const gameById = new Map((games || []).map((g: any) => [g.id, g]));
    const slotById = new Map((slots || []).map((sl: any) => [sl.id, sl]));

    const rows = safeSessions.map((s) => {
      const p = profileByUser.get(s.user_id);
      const g = gameById.get(s.game_id);
      const sl = s.slot_id ? slotById.get(s.slot_id) : null;

      const slot_start =
        sl?.start_time || s.start_time || s.started_at || s.created_at || null;
      const slot_end = sl?.end_time || s.end_time || s.ends_at || s.ended_at || null;

      return {
        id: s.id,
        created_at: s.created_at,

        status: s.status || "active",
        exit_token: s.exit_token ?? null,

        // ✅ These are used by Admin UI to hide button after scan
        ended_at: s.ended_at ?? null,
        end_time: s.end_time ?? null,
        ends_at: s.ends_at ?? null,

        full_name: p?.full_name ?? null,
        phone: p?.phone ?? null,
        email: p?.email ?? null,
        game_name: g?.name ?? g?.key ?? null,

        slot_start,
        slot_end,
      };
    });

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}