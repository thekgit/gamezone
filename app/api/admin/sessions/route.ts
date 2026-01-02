// app/api/admin/cron/auto-extend/route.ts
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
    // ✅ Cron auth: header OR ?secret=
    const url = new URL(req.url);
    const secret =
      req.headers.get("x-cron-secret") ||
      url.searchParams.get("secret") ||
      "";

    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const now = new Date();

    // ✅ overdue = ends_at < now - 5min AND still active AND not QR-ended
    const fiveMinsAgoIso = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

    const { data: overdue, error } = await admin
      .from("sessions")
      .select(
        "id,user_id,game_id,players,status,started_at,ends_at,ended_at,group_id,exit_token,visitor_name,visitor_phone,visitor_email"
      )
      .eq("status", "active")
      .is("ended_at", null) // ended_at = QR scan time (only set when user exits)
      .not("ends_at", "is", null)
      .lt("ends_at", fiveMinsAgoIso)
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let createdCount = 0;
    let checkedCount = 0;
    let skippedDuplicate = 0;

    for (const s of overdue || []) {
      checkedCount += 1;

      const group_id = s.group_id || crypto.randomUUID();
      const endsAt = s.ends_at ? new Date(s.ends_at) : null;
      if (!endsAt) continue;

      // ✅ prevent duplicate extensions for same planned boundary
      const { data: already, error: aErr } = await admin
        .from("sessions")
        .select("id")
        .eq("group_id", group_id)
        .gte("started_at", endsAt.toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      if (aErr) continue;

      if (already && already.length > 0) {
        skippedDuplicate += 1;
        continue;
      }

      // ✅ duration from games table
      const { data: gRow, error: gErr } = await admin
        .from("games")
        .select("duration_minutes")
        .eq("id", s.game_id)
        .maybeSingle();

      if (gErr) continue;

      const duration = Number(gRow?.duration_minutes ?? 60);
      const newStart = endsAt; // next session starts right at planned end
      const newEnd = addMinutes(newStart, duration);

      // ✅ close current session logically (DO NOT set ended_at here)
      // ended_at must remain null until QR scanned
      await admin.from("sessions").update({ status: "ended" }).eq("id", s.id);

      // ✅ create next session (same group_id + same exit_token so ONE QR ends all)
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
        exit_token: s.exit_token, // ✅ shared across group
        entry_token: crypto.randomBytes(12).toString("hex"),

        visitor_name: s.visitor_name ?? null,
        visitor_phone: s.visitor_phone ?? null,
        visitor_email: s.visitor_email ?? null,
      });

      if (!insErr) createdCount += 1;
    }

    return NextResponse.json({
      ok: true,
      checkedCount,
      createdCount,
      skippedDuplicate,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}