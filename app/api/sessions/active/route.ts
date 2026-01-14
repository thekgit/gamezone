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

    // ✅ resolve user from JWT (service role can do this)
    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const user_id = userRes.user.id;
    const nowIso = new Date().toISOString();

    // ✅ Active = ended_at is NULL AND ends_at is NULL or in future
    // ✅ Show sessions where:
    //    - I am owner (user_id)
    //    - OR I am in player_user_ids
    const { data, error } = await admin
      .from("sessions")
      .select(`id, players, status, started_at, ends_at, ended_at, games:game_id(name)`)
      .or(`user_id.eq.${user_id},player_user_ids.cs.{${user_id}}`)
      .is("ended_at", null)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .order("started_at", { ascending: false })
      .limit(100);

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