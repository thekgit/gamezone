import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function capacityForGameKey(gameKey: string) {
  if (gameKey === "pickleball") return 3;
  if (gameKey === "tabletennis") return 2;
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const gameKey = String(body?.game || "").toLowerCase();
    const players = Number(body?.players ?? 1);

    /* ---------------- AUTH ---------------- */
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);

    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const user_id = userRes.user.id;

    /* ---------------- GAME ---------------- */
    if (!gameKey) {
      return NextResponse.json({ error: "Missing game" }, { status: 400 });
    }

    const { data: game, error: gErr } = await admin
      .from("games")
      .select("id, key")
      .eq("key", gameKey)
      .single();

    if (gErr || !game?.id) {
      return NextResponse.json({ error: "Game not found" }, { status: 400 });
    }

    const game_id = game.id;

    /* ---------------- CAPACITY CHECK ---------------- */
    const cap = capacityForGameKey(gameKey);
    if (cap !== null) {
      const now = new Date().toISOString();

      const { count, error: cErr } = await admin
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("game_id", game_id)
        .eq("status", "active")
        .gt("end_time", now);

      if (cErr) {
        return NextResponse.json({ error: cErr.message }, { status: 500 });
      }

      if ((count || 0) >= cap) {
        return NextResponse.json(
          { error: "Slot Cannot Be Booked" },
          { status: 400 }
        );
      }
    }

    /* ---------------- CREATE SESSION ---------------- */
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hour

    const { data: session, error: insErr } = await admin
      .from("sessions")
      .insert({
        user_id,
        game_id,
        players,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: "active",
      })
      .select("id")
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "Slot has been created successfully",
      session_id: session.id,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}