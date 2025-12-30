import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type GameKey = "pickleball" | "tabletennis";

function isUuid(v: any) {
  return typeof v === "string" && /^[0-9a-fA-F-]{36}$/.test(v);
}

function sixDigitCode() {
  // 100000–999999
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: Request) {
  try {
    const admin = supabaseAdmin();

    // 1) verify user from bearer token
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing auth token" }, { status: 401 });

    const { data: uData, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !uData?.user?.id) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    const user_id = uData.user.id;

    // 2) read request body
    const body = await req.json().catch(() => ({}));
    const game = String(body?.game || "") as GameKey;
    const players = Math.max(1, Number(body?.players || 1));
    const requestedSlotId = body?.slot_id;

    if (!game || !["pickleball", "tabletennis"].includes(game)) {
      return NextResponse.json({ error: "Invalid game" }, { status: 400 });
    }

    // 3) load game row
    const { data: g, error: gErr } = await admin
      .from("games")
      .select("id, key, duration_minutes, capacity_per_slot")
      .eq("key", game)
      .single();

    if (gErr || !g?.id) return NextResponse.json({ error: gErr?.message || "Game not found" }, { status: 400 });

    const game_id = g.id;

    // 4) choose slot (manual if slot_id passed, else auto-pick next available)
    let slot_id: string | null = null;

    // a) if client sent slot_id, validate it belongs to this game
    if (isUuid(requestedSlotId)) {
      const { data: s, error: sErr } = await admin
        .from("slots")
        .select("id")
        .eq("id", requestedSlotId)
        .eq("game_id", game_id)
        .single();

      if (sErr || !s?.id) {
        return NextResponse.json({ error: "Invalid slot for this game" }, { status: 400 });
      }
      slot_id = s.id;
    } else {
      // b) AUTO: pick slot that is currently running OR the next future slot that has capacity
      const nowIso = new Date().toISOString();

      // fetch next ~50 slots starting from now-1h (so current slot is included)
      const { data: slotList, error: slotsErr } = await admin
        .from("slots")
        .select("id, start_time, end_time")
        .eq("game_id", game_id)
        .gte("end_time", new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .order("start_time", { ascending: true })
        .limit(80);

      if (slotsErr) return NextResponse.json({ error: slotsErr.message }, { status: 500 });

      const slots = slotList || [];
      if (!slots.length) {
        return NextResponse.json({ error: "No slots created for today. Run slot generator." }, { status: 400 });
      }

      // Find first slot where active bookings < capacity
      for (const s of slots) {
        // ignore slots that already ended
        if (s.end_time <= nowIso) continue;

        const { count, error: cErr } = await admin
          .from("sessions")
          .select("*", { count: "exact", head: true })
          .eq("slot_id", s.id)
          .eq("status", "active");

        if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

        if ((count || 0) < g.capacity_per_slot) {
          slot_id = s.id;
          break;
        }
      }

      if (!slot_id) {
        return NextResponse.json({ error: "Slot Cannot Be Booked" }, { status: 400 });
      }
    }

    // 5) create session with correct game_id + slot_id
    const entry_code = sixDigitCode(); // normal digits as you wanted
    const exit_token = crypto.randomUUID().replace(/-/g, ""); // secure unique

    const { data: sess, error: insErr } = await admin
      .from("sessions")
      .insert([
        {
          user_id,
          game_id,
          slot_id,
          players,
          status: "active",
          entry_token: entry_code,
          exit_token,
          started_at: new Date().toISOString(), // ✅ booking moment timeline
        },
      ])
      .select("id")
      .single();

    if (insErr || !sess?.id) {
      return NextResponse.json({ error: insErr?.message || "Failed to create session" }, { status: 500 });
    }

    return NextResponse.json({
      session_id: sess.id,
      entry_code,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}