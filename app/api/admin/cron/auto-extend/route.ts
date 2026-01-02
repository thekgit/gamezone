// ✅ FILE: app/api/admin/cron/auto-extend/route.ts
// ✅ COPY-PASTE FULL FILE (extends repeatedly forever until QR scanned)

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
    // ✅ cron protection (NO admin session needed)
    const secret = req.headers.get("x-cron-secret") || "";
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const now = new Date();

    // overdue = ends_at < now - 5 mins AND not QR ended
    const fiveMinsAgoIso = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

    const { data: overdue, error } = await admin
      .from("sessions")
      .select(
        "id,user_id,game_id,players,status,started_at,ends_at,ended_at,group_id,exit_token,visitor_name,visitor_phone,visitor_email"
      )
      .eq("status", "active")
      .is("ended_at", null) // ✅ QR not scanned yet
      .not("ends_at", "is", null)
      .lt("ends_at", fiveMinsAgoIso)
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let createdCount = 0;

    for (const s of overdue || []) {
      const group_id = s.group_id || crypto.randomUUID();
      const endsAt = s.ends_at ? new Date(s.ends_at) : null;
      if (!endsAt) continue;

      // ✅ duration from games table
      const { data: gRow } = await admin
        .from("games")
        .select("duration_minutes")
        .eq("id", s.game_id)
        .maybeSingle();

      const duration = Number(gRow?.duration_minutes ?? 60);

      // ✅ create next slot
      const newStart = endsAt;
      const newEnd = addMinutes(newStart, duration);

      // ✅ mark this active slot as ended (logical), BUT DO NOT set ended_at (ended_at = QR scan time only)
      await admin.from("sessions").update({ status: "ended" }).eq("id", s.id);

      // ✅ insert next active session (same group + same exit_token)
      const { error: insErr } = await admin.from("sessions").insert({
        user_id: s.user_id,
        game_id: s.game_id,
        players: s.players ?? 1,
        status: "active",

        started_at: newStart.toISOString(),
        ends_at: newEnd.toISOString(),
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),

        group_id, // uuid
        exit_token: s.exit_token, // ✅ single QR for whole group
        entry_token: crypto.randomBytes(12).toString("hex"),

        visitor_name: s.visitor_name ?? null,
        visitor_phone: s.visitor_phone ?? null,
        visitor_email: s.visitor_email ?? null,
      });

      if (!insErr) createdCount += 1;
    }

    return NextResponse.json({ ok: true, createdCount });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}