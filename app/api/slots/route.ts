import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const gameKey = (searchParams.get("game") || "").toLowerCase();

  if (!gameKey) return NextResponse.json({ error: "game required" }, { status: 400 });

  const admin = createClient(url, serviceKey);

  const { data: game, error: gErr } = await admin
    .from("games")
    .select("id, capacity_per_slot, duration_minutes, price_rupees, name, key")
    .eq("key", gameKey)
    .single();

  if (gErr || !game) return NextResponse.json({ error: "game not found" }, { status: 404 });

  // fetch today's slots
  const start = new Date(); start.setHours(0,0,0,0);
  const end = new Date(); end.setHours(23,59,59,999);

  const { data: slots, error: sErr } = await admin
    .from("slots")
    .select("id,start_time,end_time")
    .eq("game_id", game.id)
    .gte("start_time", start.toISOString())
    .lte("start_time", end.toISOString())
    .order("start_time", { ascending: true });

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  // count active sessions per slot
  const slotIds = (slots || []).map(s => s.id);
  let counts: Record<string, number> = {};
  if (slotIds.length) {
    const { data: ses } = await admin
      .from("sessions")
      .select("slot_id")
      .in("slot_id", slotIds)
      .eq("status", "active");

    for (const row of (ses || [])) {
      counts[row.slot_id] = (counts[row.slot_id] || 0) + 1;
    }
  }

  const result = (slots || []).map(s => {
    const used = counts[s.id] || 0;
    const full = used >= game.capacity_per_slot;
    return {
      id: s.id,
      start_time: s.start_time,
      end_time: s.end_time,
      used,
      capacity: game.capacity_per_slot,
      status: full ? "full" : "available",
    };
  });

  return NextResponse.json({
    game: {
      key: game.key,
      name: game.name,
      duration_minutes: game.duration_minutes,
      price_rupees: game.price_rupees,
      capacity_per_slot: game.capacity_per_slot,
    },
    slots: result,
  });
}