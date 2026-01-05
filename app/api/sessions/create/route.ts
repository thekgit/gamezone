import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function token(len = 12) {
  return crypto.randomBytes(len).toString("hex");
}

function nowIso() {
  return new Date().toISOString();
}

function addMinutesIso(iso: string, mins: number) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + mins);
  return d.toISOString();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // preferred
    const game_id_from_client = String(body?.game_id || "").trim();
    // legacy (some old client sends game key or name)
    const game_legacy = String(body?.game || "").trim();

    const players = Number(body?.players ?? 1);

    const auth = req.headers.get("authorization") || "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!jwt) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const admin = supabaseAdmin();

    // ✅ resolve user once
    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const user = userRes.user;
    const user_id = user.id;
    const email = (user.email || "").toLowerCase();

    // ✅ resolve game
    let gameRow: any = null;

    if (game_id_from_client) {
      const { data: g, error: gErr } = await admin
        .from("games")
        .select("id, name, duration_minutes, court_count, is_active")
        .eq("id", game_id_from_client)
        .maybeSingle();
      if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });
      gameRow = g;
    } else if (game_legacy) {
      // try by key (if you have it)
      const { data: g1 } = await admin
        .from("games")
        .select("id, name, duration_minutes, court_count, is_active")
        // @ts-ignore: if column exists
        .eq("key", game_legacy)
        .maybeSingle();

      if (g1?.id) {
        gameRow = g1;
      } else {
        // try by name
        const { data: g2, error: g2Err } = await admin
          .from("games")
          .select("id, name, duration_minutes, court_count, is_active")
          .ilike("name", game_legacy)
          .maybeSingle();
        if (g2Err) return NextResponse.json({ error: g2Err.message }, { status: 500 });
        gameRow = g2;
      }
    }

    if (!gameRow?.id) return NextResponse.json({ error: "Game not found" }, { status: 400 });
    if (gameRow.is_active === false) {
      return NextResponse.json({ error: "Game is not active" }, { status: 400 });
    }

    const game_id = gameRow.id;
    const duration_minutes = Number(gameRow.duration_minutes ?? 60);
    const capacity = Math.max(1, Number(gameRow.court_count ?? 1));

    // ✅ compute started/ends ISO (fixes your red lines)
    const started_at_iso = nowIso();
    const ends_at_iso = addMinutesIso(started_at_iso, duration_minutes);

    // ✅ capacity check: active sessions for this game "now"
    const { count: activeCount, error: countErr } = await admin
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("game_id", game_id)
      .or("status.eq.active,status.is.null") // treat null as active (optional)
      .is("ended_at", null)
      .gt("ends_at", started_at_iso); // still running

    if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });

    if ((activeCount ?? 0) >= capacity) {
      return NextResponse.json({ error: "SLOT_FULL" }, { status: 409 });
    }

    // ✅ get visitor fields (so admin shows details)
    let full_name: string | null = null;
    let phone: string | null = null;

    // A) profiles (if exists)
    const { data: prof } = await admin
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user_id)
      .maybeSingle();

    if (prof?.full_name) full_name = prof.full_name;
    if (prof?.phone) phone = prof.phone;

    // B) company_employees fallback (imported users)
    if (!full_name || !phone) {
      const { data: emp } = await admin
        .from("company_employees")
        .select("full_name, phone")
        .eq("email", email)
        .maybeSingle();

      if (!full_name && emp?.full_name) full_name = emp.full_name;
      if (!phone && emp?.phone) phone = emp.phone;
    }

    // C) auth metadata fallback
    const meta: any = user.user_metadata || {};
    if (!full_name && meta.full_name) full_name = String(meta.full_name);
    if (!phone && meta.phone) phone = String(meta.phone);

    // ✅ tokens used for entry/exit flow
    const entry_token = token(16);
    const exit_token = token(16);

    // ✅ insert session
    const { data: created, error: insErr } = await admin
      .from("sessions")
      .insert({
        user_id,
        game_id,
        players,
        status: "active",

        // booking window
        started_at: started_at_iso,
        ends_at: ends_at_iso,

        // visitor fields (fixes "-" in admin)
        visitor_name: full_name || meta.full_name || email || null,
        visitor_phone: phone || meta.phone || null,
        visitor_email: email || null,

        // tokens (exit QR)
        entry_token,
        exit_token,
      })
      .select("id, entry_token, exit_token")
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // ✅ stable response for your UI
    return NextResponse.json({
      ok: true,
      message: "Slot has been created successfully",
      session_id: created.id,
      entry_token: created.entry_token,
      exit_token: created.exit_token,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}