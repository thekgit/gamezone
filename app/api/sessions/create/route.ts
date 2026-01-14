import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function token(len = 16) {
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

    const game_id_from_client = String(body?.game_id || "").trim();
    const game_legacy = String(body?.game || "").trim();
    const players = Number(body?.players ?? 1);

    // ✅ extra players (optional)
    const rawOthers = Array.isArray(body?.player_user_ids) ? body.player_user_ids : [];
    const player_user_ids = Array.from(
      new Set(rawOthers.map((x: any) => String(x || "").trim()).filter(Boolean))
    ).slice(0, 8);

    // ✅ auth
    const auth = req.headers.get("authorization") || "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!jwt) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const admin = supabaseAdmin();

    // ✅ resolve user (MUST succeed)
    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const user = userRes.user;
    const user_id = user.id;
    const email = (user.email || "").toLowerCase();

    // ✅ resolve game (by id OR legacy)
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
      const { data: g2, error: g2Err } = await admin
        .from("games")
        .select("id, name, duration_minutes, court_count, is_active")
        .ilike("name", game_legacy)
        .maybeSingle();

      if (g2Err) return NextResponse.json({ error: g2Err.message }, { status: 500 });
      gameRow = g2;
    }

    if (!gameRow?.id) return NextResponse.json({ error: "Game not found" }, { status: 400 });
    if (gameRow.is_active === false) {
      return NextResponse.json({ error: "Game is not active" }, { status: 400 });
    }

    const game_id = gameRow.id;
    const duration_minutes = Number(gameRow.duration_minutes ?? 60);
    const capacity = Math.max(1, Number(gameRow.court_count ?? 1));

    const started_at_iso = nowIso();
    const ends_at_iso = addMinutesIso(started_at_iso, duration_minutes);

    // ✅ capacity check
    const { count: activeCount, error: countErr } = await admin
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("game_id", game_id)
      .is("ended_at", null)
      .or("status.is.null,status.eq.active")
      .gt("ends_at", started_at_iso);

    if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });

    if ((activeCount ?? 0) >= capacity) {
      return NextResponse.json({ error: "SLOT_FULL" }, { status: 409 });
    }

    // ✅ visitor fields (FIX: profiles.user_id, not profiles.id)
    let full_name: string | null = null;
    let phone: string | null = null;

    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", user_id)
      .maybeSingle();

    if (profErr) {
      // don't fail booking because of profile read
      // (but we keep error visible for debugging)
      console.error("profiles read error:", profErr.message);
    } else {
      if (prof?.full_name) full_name = prof.full_name;
      if (prof?.phone) phone = prof.phone;
    }

    // fallback: company_employees by email
    if (!full_name || !phone) {
      const { data: emp, error: empErr } = await admin
        .from("company_employees")
        .select("full_name, phone")
        .eq("email", email)
        .maybeSingle();

      if (empErr) console.error("company_employees read error:", empErr.message);

      if (!full_name && emp?.full_name) full_name = emp.full_name;
      if (!phone && emp?.phone) phone = emp.phone;
    }

    // fallback: auth metadata
    const meta: any = user.user_metadata || {};
    if (!full_name && meta.full_name) full_name = String(meta.full_name);
    if (!phone && meta.phone) phone = String(meta.phone);

    // ✅ tokens
    const entry_token = token(16);
    const exit_token = token(16);

    // ✅ INSERT session (MUST happen)
    const { data: created, error: insErr } = await admin
      .from("sessions")
      .insert({
        user_id,
        game_id,
        players,
        player_user_ids,
        status: "active",
        started_at: started_at_iso,
        ends_at: ends_at_iso,

        visitor_name: full_name || email || null,
        visitor_phone: phone || null,
        visitor_email: email || null,

        entry_token,
        exit_token,
      })
      .select("id, entry_token, exit_token")
      .single();

    if (insErr) {
      console.error("sessions insert error:", insErr.message);
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    if (!created?.id) {
      return NextResponse.json({ error: "Session insert failed (id missing)" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "Slot has been created successfully",
      session_id: created.id,
      entry_token: created.entry_token,
      exit_token: created.exit_token,
    });
  } catch (e: any) {
    console.error("create session fatal:", e?.message || e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}