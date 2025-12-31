import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const game = body.game;
    const players = Number(body.players || 1);

    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const { data: userData } = await admin.auth.getUser(token);
    const user_id = userData?.user?.id;

    if (!user_id) {
      return NextResponse.json({ error: "INVALID_SESSION" }, { status: 401 });
    }

    // Resolve game_id
    const { data: gameRow } = await admin
      .from("games")
      .select("id, key")
      .eq("key", game)
      .single();

    if (!gameRow) {
      return NextResponse.json({ error: "GAME_NOT_FOUND" }, { status: 400 });
    }

    // Capacity rule
    const cap = game === "pickleball" ? 3 : 2;

    const now = new Date();
    const { count } = await admin
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("game_id", gameRow.id)
      .eq("status", "active")
      .gt("end_time", now.toISOString());

    if ((count || 0) >= cap) {
      return NextResponse.json({ error: "SLOT_FULL" }, { status: 400 });
    }

    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const { data: created, error } = await admin
      .from("sessions")
      .insert({
        user_id,
        game_id: gameRow.id,
        players,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: "active",
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      session_id: created.id,
      message: "Slot has been created successfully",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}