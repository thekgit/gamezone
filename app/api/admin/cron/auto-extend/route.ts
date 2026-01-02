import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function addMinutes(d: Date, mins: number) {
  return new Date(d.getTime() + mins * 60 * 1000);
}

export async function POST(req: Request) {
  try {
    // ✅ protect by secret header (cron friendly)
    const secret = req.headers.get("x-cron-secret") || "";
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const now = new Date();
    const nowMinus5Iso = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

    // find overdue active sessions: ends_at < now-5min, not QR-exited yet
    const { data: overdue, error } = await admin
      .from("sessions")
      .select(
        "id,game_id,players,status,started_at,ends_at,ended_at,group_id,exit_token,user_id,visitor_name,visitor_phone,visitor_email"
      )
      .eq("status", "active")
      .is("ended_at", null) // QR not scanned yet
      .not("ends_at", "is", null)
      .lt("ends_at", nowMinus5Iso)
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let createdCount = 0;
    let processedCount = 0;

    for (const s of overdue || []) {
      processedCount++;

      if (!s.ends_at) continue;
      if (!s.exit_token) continue;

      // ✅ ONE stable key for the whole chain
      // If group_id missing, we use exit_token as group key
      const groupKey: string = (s.group_id || s.exit_token) as string;

      // ✅ backfill group_id on old records so they group in UI
      if (!s.group_id) {
        await admin.from("sessions").update({ group_id: groupKey }).eq("id", s.id);
      }

      // load duration
      const { data: gRow } = await admin
        .from("games")
        .select("duration_minutes")
        .eq("id", s.game_id)
        .maybeSingle();

      const duration = Number(gRow?.duration_minutes ?? 60);

      // we will extend repeatedly until we have a "current" session that is not overdue
      let currentSessionId = s.id as string;
      let currentEndsAt = new Date(s.ends_at as string);

      // safety: avoid infinite loops if something goes wrong
      for (let i = 0; i < 20; i++) {
        // if NOT overdue anymore, stop
        if (currentEndsAt.toISOString() >= nowMinus5Iso) break;

        const nextStart = currentEndsAt;
        const nextEnd = addMinutes(nextStart, duration);

        // ✅ If a next session already exists for this exact start time, jump to it (no duplicates)
        const { data: existingNext } = await admin
          .from("sessions")
          .select("id, ends_at")
          .eq("group_id", groupKey)
          .eq("started_at", nextStart.toISOString())
          .limit(1);

        if (existingNext && existingNext.length > 0) {
          // mark current ended (status only)
          await admin.from("sessions").update({ status: "ended" }).eq("id", currentSessionId);

          currentSessionId = existingNext[0].id;
          currentEndsAt = existingNext[0].ends_at ? new Date(existingNext[0].ends_at) : nextEnd;
          continue;
        }

        // ✅ mark current ended (DO NOT set ended_at; ended_at = QR scan time)
        await admin.from("sessions").update({ status: "ended" }).eq("id", currentSessionId);

        // ✅ create next active session (same group_id + same exit_token)
        const { data: inserted, error: insErr } = await admin
          .from("sessions")
          .insert({
            user_id: s.user_id,
            game_id: s.game_id,
            players: s.players ?? 1,
            status: "active",

            started_at: nextStart.toISOString(),
            ends_at: nextEnd.toISOString(),
            start_time: nextStart.toISOString(),
            end_time: nextEnd.toISOString(),

            group_id: groupKey,
            exit_token: s.exit_token, // ✅ SAME QR FOR WHOLE CHAIN
            entry_token: crypto.randomBytes(12).toString("hex"),

            visitor_name: s.visitor_name ?? null,
            visitor_phone: s.visitor_phone ?? null,
            visitor_email: s.visitor_email ?? null,
          })
          .select("id, ends_at")
          .single();

        if (insErr) break;

        createdCount++;
        currentSessionId = inserted.id;
        currentEndsAt = inserted.ends_at ? new Date(inserted.ends_at) : nextEnd;
      }
    }

    return NextResponse.json({ ok: true, processedCount, createdCount });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}