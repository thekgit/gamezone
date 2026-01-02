import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function token(len = 16) {
  return crypto.randomBytes(len).toString("hex");
}

/**
 * Rule:
 * If a session is still ACTIVE and its ends_at passed by > 5 minutes,
 * auto-close it and create a NEW session for same user/game/players.
 * Uses SAME group_id so UI can merge later.
 */
export async function POST() {
  try {
    // Keep admin-only, OR replace with a secret header check if you want cron public.
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    const now = new Date();
    const fiveMinAgoIso = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

    // Find overdue active sessions
    const { data: overdue, error } = await admin
      .from("sessions")
      .select(
        "id, user_id, game_id, players, started_at, ends_at, status, group_id, visitor_name, visitor_phone, visitor_email"
      )
      .eq("status", "active")
      .not("ends_at", "is", null)
      .lt("ends_at", fiveMinAgoIso)
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!overdue || overdue.length === 0) return NextResponse.json({ ok: true, updated: 0 });

    let updated = 0;

    for (const s of overdue as any[]) {
      // Load game duration (fallback 60)
      const { data: g, error: gErr } = await admin
        .from("games")
        .select("duration_minutes, is_active")
        .eq("id", s.game_id)
        .single();

      if (gErr || !g || g.is_active === false) continue;

      const durMin = Number(g.duration_minutes ?? 60);
      const startNew = new Date(s.ends_at); // new session starts exactly at previous end
      const endNew = new Date(startNew.getTime() + durMin * 60 * 1000);

      // 1) End old session (auto)
      const { error: endErr } = await admin
        .from("sessions")
        .update({ status: "ended" })
        .eq("id", s.id);

      if (endErr) continue;

      // 2) Create new session same group_id
      const group_id = s.group_id || crypto.randomUUID();

      const { error: insErr } = await admin.from("sessions").insert({
        user_id: s.user_id,
        game_id: s.game_id,
        players: s.players ?? 1,
        status: "active",
        started_at: startNew.toISOString(),
        ends_at: endNew.toISOString(),
        start_time: startNew.toISOString(),
        end_time: endNew.toISOString(),
        entry_token: token(12),
        exit_token: token(12),
        visitor_name: s.visitor_name ?? null,
        visitor_phone: s.visitor_phone ?? null,
        visitor_email: s.visitor_email ?? null,
        group_id,
      });

      if (!insErr) updated += 1;
    }

    return NextResponse.json({ ok: true, updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}