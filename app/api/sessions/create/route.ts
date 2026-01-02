import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function token(len = 12) {
  return crypto.randomBytes(len).toString("hex");
}

function getNowIso() {
  return new Date().toISOString();
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

    // resolve user
    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    const user_id = userRes.user.id;

    // resolve game
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
      // try by key
      const { data: g1 } = await admin
        .from("games")
        .select("id, name, duration_minutes, court_count, is_active")
        // @ts-ignore key exists in your schema
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
    if (gameRow.is_active === false) return NextResponse.json({ error: "Game is not active" }, { status: 400 });

    const game_id = gameRow.id;

    // capacity check from DB (court_count)
    const nowIso = getNowIso();
    const capacity = Number(gameRow.court_count ?? 1);

    const { count, error: cErr } = await admin
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("game_id", game_id)
      .eq("status", "active")
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`);

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
    if ((count || 0) >= capacity) return NextResponse.json({ error: "SLOT_FULL" }, { status: 400 });

    const durationMinutes = Number(gameRow.duration_minutes ?? 60);
    const started_at = new Date();
    const ends_at = new Date(started_at.getTime() + durationMinutes * 60 * 1000);

    const entry_token = token(12);
    const exit_token = token(12);

    // profile info
    const { data: p } = await admin
      .from("profiles")
      .select("full_name, phone, email")
      .eq("user_id", user_id)
      .maybeSingle();

    const { data: created, error: insErr } = await admin
      .from("sessions")
      .insert({
        user_id,
        game_id,
        players,
        status: "active",

        started_at: started_at.toISOString(),
        ends_at: ends_at.toISOString(),

        start_time: started_at.toISOString(),
        end_time: ends_at.toISOString(),

        entry_token,
        exit_token,

        visitor_name: p?.full_name ?? null,
        visitor_phone: p?.phone ?? null,
        visitor_email: p?.email ?? null,
      })
      .select("id, entry_token, exit_token")
      .single();

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    // IMPORTANT: keep response stable for your UI
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