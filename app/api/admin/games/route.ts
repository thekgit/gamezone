// ✅ FILE: app/api/admin/games/route.ts
// ✅ COPY-PASTE FULL FILE

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^_+|_+$/g, "");
}

export async function GET() {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    const { data: games, error } = await admin
      .from("games")
      .select("id, key, name, duration_minutes, court_count, capacity_per_slot, price_rupees, is_active, created_at")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // ✅ IMPORTANT FIX:
    // Keep slot green until QR is scanned (ended_at is set).
    const { data: sess, error: sErr } = await admin
      .from("sessions")
      .select("game_id")
      .is("ended_at", null); // ✅ not ended by QR yet

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

    const activeByGame: Record<string, number> = {};
    for (const row of sess || []) {
      const gid = (row as any).game_id as string | null;
      if (!gid) continue;
      activeByGame[gid] = (activeByGame[gid] || 0) + 1;
    }

    return NextResponse.json({ games: games || [], activeByGame });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    const name = String(body?.name || "").trim();
    if (!name) return NextResponse.json({ error: "Game name required" }, { status: 400 });

    const key = String(body?.key || slugify(name));

    const duration_minutes = Number(body?.duration_minutes ?? 60);
    const court_count = Number(body?.court_count ?? 1);

    const capacity_per_slot = Number(body?.capacity_per_slot ?? 1);
    const price_rupees = Number(body?.price_rupees ?? body?.price ?? 0);

    const admin = supabaseAdmin();

    const { data, error } = await admin
      .from("games")
      .insert({
        key,
        name,
        duration_minutes: Number.isFinite(duration_minutes) ? duration_minutes : 60,
        court_count: Number.isFinite(court_count) ? court_count : 1,
        capacity_per_slot: Number.isFinite(capacity_per_slot) ? capacity_per_slot : 1,
        price_rupees: Number.isFinite(price_rupees) ? price_rupees : 0,
        is_active: true,
      })
      .select("id, key, name, duration_minutes, court_count, capacity_per_slot, price_rupees, is_active, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ game: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const updatePayload: any = {};

    if (body?.name != null) updatePayload.name = String(body.name).trim();
    if (!updatePayload.name) return NextResponse.json({ error: "Game name required" }, { status: 400 });

    if (body?.duration_minutes != null) updatePayload.duration_minutes = Number(body.duration_minutes) || 60;
    if (body?.court_count != null) updatePayload.court_count = Number(body.court_count) || 1;

    if (body?.price_rupees != null) updatePayload.price_rupees = Number(body.price_rupees) || 0;
    if (body?.capacity_per_slot != null) updatePayload.capacity_per_slot = Number(body.capacity_per_slot) || 1;
    if (body?.key != null) updatePayload.key = String(body.key).trim();

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("games")
      .update(updatePayload)
      .eq("id", id)
      .select("id, key, name, duration_minutes, court_count, capacity_per_slot, price_rupees, is_active, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ game: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const admin = supabaseAdmin();
    const { error } = await admin.from("games").update({ is_active: false }).eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}