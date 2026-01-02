import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function addMinutes(d: Date, mins: number) {
  return new Date(d.getTime() + mins * 60 * 1000);
}

export async function POST() {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const now = new Date();

    // sessions overdue by > 5 minutes past planned ends_at, still active, not ended_at
    const thresholdIso = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

    const { data: overdue, error } = await admin
      .from("sessions")
      .select(
        "id,user_id,game_id,players,status,started_at,ends_at,ended_at,group_id,exit_token,visitor_name,visitor_phone,visitor_email"
      )
      .eq("status", "active")
      .is("ended_at", null)
      .not("ends_at", "is", null)
      .lt("ends_at", thresholdIso)
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // fetch durations for all involved games (1 query)
    const gameIds = Array.from(
      new Set((overdue || []).map((s: any) => s.game_id).filter(Boolean))
    );

    const durationByGame: Record<string, number> = {};
    if (gameIds.length) {
      const { data: games, error: gErr } = await admin
        .from("games")
        .select("id,duration_minutes")
        .in("id", gameIds);

      if (gErr) {
        return NextResponse.json({ error: gErr.message }, { status: 500 });
      }

      for (const g of games || []) {
        durationByGame[g.id] = Number(g.duration_minutes ?? 60);
      }
    }

    let createdCount = 0;

    for (const s of overdue || []) {
      const endsAtIso = s.ends_at as string | null;
      if (!endsAtIso) continue;

      const endsAt = new Date(endsAtIso);

      // ensure group_id exists (so the whole chain is linked)
      const group_id = (s.group_id as string | null) || crypto.randomUUID();
      if (!s.group_id) {
        await admin.from("sessions").update({ group_id }).eq("id", s.id);
      }

      // prevent duplicate auto-extension:
      // if a session already exists in same group starting at/after endsAt, skip
      const { data: already, error: aErr } = await admin
        .from("sessions")
        .select("id")
        .eq("group_id", group_id)
        .gte("started_at", endsAt.toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      if (aErr) continue;

      if (already && already.length > 0) {
        // still end the current one at planned end so it doesn't stay "active"
        await admin
          .from("sessions")
          .update({ status: "ended", ended_at: endsAt.toISOString() })
          .eq("id", s.id);
        continue;
      }

      const duration = durationByGame[s.game_id] ?? 60;
      const newStart = endsAt;
      const newEnd = addMinutes(newStart, duration);

      // end current session at its planned end
      await admin
        .from("sessions")
        .update({ status: "ended" }) // ✅ DO NOT touch ended_at here
        .eq("id", s.id);

      // create next active session (same group_id + same exit_token so QR is ONE for the group)
      const { error: insErr } = await admin.from("sessions").insert({
        user_id: s.user_id,
        game_id: s.game_id,
        players: s.players ?? 1,

        status: "active",
        started_at: newStart.toISOString(),
        ends_at: newEnd.toISOString(),
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),

        group_id,
        exit_token: s.exit_token, // shared across group
        entry_token: crypto.randomBytes(12).toString("hex"),

        visitor_name: s.visitor_name ?? null,
        visitor_phone: s.visitor_phone ?? null,
        visitor_email: s.visitor_email ?? null,
      });

      if (!insErr) createdCount += 1;
    }

    return NextResponse.json({ ok: true, createdCount });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}