import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function token(len = 16) {
  return crypto.randomBytes(len).toString("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // ✅ NEW preferred input
    const game_id_from_client = String(body?.game_id || "").trim();

    // ✅ Backward compatibility (old client)
    const game_legacy = String(body?.game || "").trim(); // e.g. "pickleball" or "Table Tennis"

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

    // ✅ Resolve game row ONCE
    let gameRow:
      | {
          id: string;
          name: string;
          duration_minutes: number | null;
          court_count: number | null;
          price: number | null;
          is_active: boolean | null;
        }
      | null = null;

    if (game_id_from_client) {
      const { data: g, error: gErr } = await admin
        .from("games")
        .select("id, name, duration_minutes, court_count, price, is_active")
        .eq("id", game_id_from_client)
        .maybeSingle();

      if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });
      gameRow = g as any;
    } else if (game_legacy) {
      // Try key (if your schema has it), else name
      const { data: g1 } = await admin
        .from("games")
        .select("id, name, duration_minutes, court_count, price, is_active")
        // @ts-ignore
        .eq("key", game_legacy)
        .maybeSingle();

      if (g1?.id) {
        gameRow = g1 as any;
      } else {
        const { data: g2, error: g2Err } = await admin
          .from("games")
          .select("id, name, duration_minutes, court_count, price, is_active")
          .ilike("name", game_legacy); // exact-ish match (works if old client sends name)

        if (g2Err) return NextResponse.json({ error: g2Err.message }, { status: 500 });

        // if multiple returned, take first
        gameRow = Array.isArray(g2) ? (g2[0] as any) : (g2 as any);
      }
    }

    if (!gameRow?.id) {
      return NextResponse.json({ error: "Game not found" }, { status: 400 });
    }

    if (gameRow.is_active === false) {
      return NextResponse.json({ error: "Game is not active" }, { status: 400 });
    }

    const game_id = gameRow.id;

    // ✅ Capacity check from DB (court_count)
    const capacity = Number(gameRow.court_count ?? 1);
    const nowIso = new Date().toISOString();

    const { count, error: cErr } = await admin
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("game_id", game_id)
      .eq("status", "active")
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`);

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

    if ((count || 0) >= capacity) {
      return NextResponse.json({ error: "SLOT_FULL" }, { status: 400 });
    }

    // ✅ Session duration from DB (duration_minutes), fallback 60
    const durationMinutes = Number(gameRow.duration_minutes ?? 60);
    const started_at = new Date();
    const ends_at = new Date(started_at.getTime() + durationMinutes * 60 * 1000);

    const entry_token = token(12);
    const exit_token = token(12);

    // ✅ pull visitor details from profiles
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
        group_id: crypto.randomUUID(),
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