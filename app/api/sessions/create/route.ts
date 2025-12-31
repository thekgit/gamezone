import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function capacityForGameKey(game: string) {
  if (game === "pickleball") return 3;
  if (game === "tabletennis") return 2;
  return null;
}

function token(len = 16) {
  return crypto.randomBytes(len).toString("hex"); // 32 chars if len=16
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const game = String(body?.game || "");
    const players = Number(body?.players ?? 1);

    // ✅ Bearer token from client
    const auth = req.headers.get("authorization") || "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!jwt) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const admin = supabaseAdmin();

    // ✅ resolve user_id
    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    const user_id = userRes.user.id;

    if (!game) return NextResponse.json({ error: "Missing game" }, { status: 400 });

    // ✅ resolve game_id (expects games.key = pickleball/tabletennis)
    const { data: g, error: gErr } = await admin
      .from("games")
      .select("id, key, name")
      .eq("key", game)
      .single();

    if (gErr || !g?.id) return NextResponse.json({ error: "Game not found" }, { status: 400 });
    const game_id = g.id;

    // ✅ capacity check: count active sessions not ended yet
    const cap = capacityForGameKey(game);
    if (cap != null) {
      const nowIso = new Date().toISOString();

      const { count, error: cErr } = await admin
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("game_id", game_id)
        .eq("status", "active")
        .or(`ends_at.is.null,ends_at.gt.${nowIso}`);

      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

      if ((count || 0) >= cap) {
        return NextResponse.json({ error: "SLOT_FULL" }, { status: 400 });
      }
    }

    // ✅ create 1-hour session starting NOW
    const started_at = new Date();
    const ends_at = new Date(started_at.getTime() + 60 * 60 * 1000);

    const entry_token = token(12);
    const exit_token = token(12);

    // ✅ pull visitor details from profiles (so admin panel shows name/phone/email)
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
        start_time: started_at.toISOString(), // keep both for compatibility
        end_time: ends_at.toISOString(),
        entry_token,
        exit_token,
        visitor_name: p?.full_name ?? null,
        visitor_phone: p?.phone ?? null,
        visitor_email: p?.email ?? null,
      })
      .select("id")
      .single();

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      message: "Slot has been created successfully",
      session_id: created.id,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}