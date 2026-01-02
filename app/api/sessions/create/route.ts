import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // IMPORTANT: server-side
);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const game_id = String(body?.game_id || "").trim();
    const players = Number(body?.players ?? 1);
    const visitor_name = String(body?.visitor_name || "").trim();
    const visitor_phone = String(body?.visitor_phone || "").trim();
    const visitor_email = String(body?.visitor_email || "").trim();

    if (!game_id) return NextResponse.json({ error: "Missing game_id" }, { status: 400 });
    if (!visitor_name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
    if (!Number.isFinite(players) || players <= 0)
      return NextResponse.json({ error: "Invalid players" }, { status: 400 });

    // 1) Read game duration + court_count
    const { data: game, error: gErr } = await supabase
      .from("games")
      .select("id, duration_minutes, court_count, is_active")
      .eq("id", game_id)
      .single();

    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });
    if (!game || game.is_active === false) {
      return NextResponse.json({ error: "Game not available" }, { status: 400 });
    }

    const duration_minutes = Number(game.duration_minutes || 60);
    const court_count = Number(game.court_count || 1);

    // 2) Check current active sessions for this game (capacity = court_count)
    const nowIso = new Date().toISOString();

    const { data: active, error: aErr } = await supabase
      .from("sessions")
      .select("id")
      .eq("game_id", game_id)
      .eq("status", "active")
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`);

    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

    const activeCount = (active || []).length;
    if (activeCount >= court_count) {
      return NextResponse.json({ error: "All slots are occupied. Try later." }, { status: 409 });
    }

    // 3) Create an ACTIVE session
    const started_at = new Date();
    const ends_at = new Date(started_at.getTime() + duration_minutes * 60 * 1000);

    const entry_token = crypto.randomUUID().replace(/-/g, "");
    const exit_token = crypto.randomUUID().replace(/-/g, "");

    const { data: created, error: cErr } = await supabase
      .from("sessions")
      .insert({
        game_id,
        players,
        status: "active",
        visitor_name,
        visitor_phone,
        visitor_email,

        started_at: started_at.toISOString(),
        ends_at: ends_at.toISOString(),

        entry_token,
        exit_token,
      })
      .select("id, started_at, ends_at, status")
      .single();

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

    return NextResponse.json({ session: created });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}