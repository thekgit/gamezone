import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function addMinutes(d: Date, mins: number) {
  return new Date(d.getTime() + mins * 60 * 1000);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const game_id = String(body?.game_id || "").trim();
    const players = Number(body?.players ?? 1);

    if (!game_id) return NextResponse.json({ error: "Missing game_id" }, { status: 400 });
    if (!Number.isFinite(players) || players <= 0) {
      return NextResponse.json({ error: "Invalid players" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data: g, error: gErr } = await admin
      .from("games")
      .select("id,duration_minutes,is_active")
      .eq("id", game_id)
      .maybeSingle();

    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });
    if (!g?.id) return NextResponse.json({ error: "Game not found" }, { status: 404 });
    if (g?.is_active === false) return NextResponse.json({ error: "Game inactive" }, { status: 400 });

    const duration = Number(g.duration_minutes ?? 60);

    const group_id = crypto.randomUUID();
    const exit_token = crypto.randomBytes(16).toString("hex");
    const entry_token = crypto.randomBytes(12).toString("hex");

    const start = new Date();
    const end = addMinutes(start, duration);

    const payload = {
      user_id: body?.user_id ?? null,
      game_id,
      players,
      status: "active",

      started_at: start.toISOString(),
      ends_at: end.toISOString(),
      start_time: start.toISOString(),
      end_time: end.toISOString(),

      group_id,
      exit_token,
      entry_token,

      visitor_name: body?.visitor_name ?? null,
      visitor_phone: body?.visitor_phone ?? null,
      visitor_email: body?.visitor_email ?? null,
    };

    const { data, error } = await admin
      .from("sessions")
      .insert(payload)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ session: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/sessions is alive" });
}