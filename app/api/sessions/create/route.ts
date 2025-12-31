import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function capacityForGameKey(game: string) {
  if (game === "pickleball") return 3;
  if (game === "tabletennis") return 2;
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const game = String(body?.game || "");
    const players = Number(body?.players ?? 1);

    // ✅ Read Bearer token
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    // ✅ Convert token -> user
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    const user_id = userRes.user.id;

    if (!game) {
      return NextResponse.json({ error: "Missing game" }, { status: 400 });
    }

    // ✅ Resolve game_id from games.key
    const { data: g, error: gErr } = await admin
      .from("games")
      .select("id, key, name")
      .eq("key", game)
      .single();

    if (gErr || !g?.id) {
      return NextResponse.json({ error: "Game not found (missing games.key?)" }, { status: 400 });
    }

    const resolvedGameId = g.id;

    // ✅ Capacity check for active sessions
    const cap = capacityForGameKey(game);
    if (cap != null) {
      const nowIso = new Date().toISOString();

      const { count, error: cErr } = await admin
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("game_id", resolvedGameId)
        .eq("status", "active")
        .gt("end_time", nowIso);

      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

      if ((count || 0) >= cap) {
        return NextResponse.json({ error: "SLOT_FULL" }, { status: 400 });
      }
    }

    // ✅ Create 1 hour slot starting NOW
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const { data: created, error: insErr } = await admin
      .from("sessions")
      .insert({
        user_id,
        game_id: resolvedGameId,
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
      session_id: created.id,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}