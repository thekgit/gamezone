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
    // ✅ cron protection (no admin login needed)
    const secret = req.headers.get("x-cron-secret") || "";
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const now = new Date();

    // overdue = active, not QR-ended, ends_at exists, ends_at < now - 5min
    const fiveMinsAgoIso = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

    const { data: overdue, error } = await admin
      .from("sessions")
      .select(
        "id,user_id,game_id,players,status,started_at,ends_at,ended_at,group_id,exit_token,visitor_name,visitor_phone,visitor_email"
      )
      .eq("status", "active")
      .is("ended_at", null)
      .not("ends_at", "is", null)
      .lt("ends_at", fiveMinsAgoIso)
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let createdCount = 0;

    for (const s of overdue || []) {
      const endsAt = s.ends_at ? new Date(s.ends_at) : null;
      if (!endsAt) continue;

      // ✅ ensure group_id is a UUID
      let group_id = s.group_id;
      if (!group_id) {
        group_id = crypto.randomUUID();
        // backfill the old session so UI grouping works
        await admin.from("sessions").update({ group_id }).eq("id", s.id);
      }

      // ✅ if there is already a session in this group that starts at/after endsAt, skip
      const { data: already } = await admin
        .from("sessions")
        .select("id")
        .eq("group_id", group_id)
        .gte("started_at", endsAt.toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      if (already && already.length > 0) continue;

      // ✅ duration
      const { data: gRow, error: gErr } = await admin
        .from("games")
        .select("duration_minutes")
        .eq("id", s.game_id)
        .maybeSingle();

      if (gErr) continue;

      const duration = Number(gRow?.duration_minutes ?? 60);
      const newStart = endsAt;
      const newEnd = addMinutes(newStart, duration);

      // ✅ mark previous as ended (NOT ended_at)
      await admin.from("sessions").update({ status: "ended" }).eq("id", s.id);

      // ✅ create next session (same group + same exit_token = ONE QR for all)
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
        exit_token: s.exit_token,
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