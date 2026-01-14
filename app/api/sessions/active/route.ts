import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!jwt) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const admin = supabaseAdmin();

    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const user_id = userRes.user.id;
    const nowIso = new Date().toISOString();

    // ✅ Active sessions where:
    // - I am the owner (user_id)
    // OR
    // - I am included in player_user_ids (json/array column)
    // AND not ended yet
    const { data, error } = await admin
      .from("sessions")
      .select(
        `
        id,
        players,
        started_at,
        ends_at,
        ended_at,
        status,
        games:game_id ( name )
      `
      )
      .or(`user_id.eq.${user_id},player_user_ids.cs.{${user_id}}`)
      .is("ended_at", null)
      .eq("status", "active")
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .order("started_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const sessions = (data || []).map((s: any) => ({
      id: s.id,
      game_name: s?.games?.name ?? null,
      players: s.players ?? null,
      started_at: s.started_at ?? null,
      ends_at: s.ends_at ?? null,
      status: s.status ?? null,
    }));

    return NextResponse.json({ sessions }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}