import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    // ✅ Get user_id from cookie/session (depends on your auth)
    // If you're using Supabase auth cookies, you should read the user via server client.
    // For now, we’ll accept user_id as query param to keep it simple.
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get("user_id");

    if (!user_id) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const nowIso = new Date().toISOString();

    const { data, error } = await admin
      .from("sessions")
      .select(`
        id,
        status,
        players,
        started_at,
        ends_at,
        created_at,
        games:game_id ( name )
      `)
      .eq("user_id", user_id)
      .eq("status", "active")
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const sessions = (data || []).map((s: any) => ({
      id: s.id,
      game_name: s?.games?.name ?? null,
      players: s.players ?? null,
      started_at: s.started_at ?? null,
      ends_at: s.ends_at ?? null,
      status: s.status ?? null,
    }));

    return NextResponse.json({ sessions });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}