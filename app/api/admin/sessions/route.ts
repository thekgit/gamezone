import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// map possible real DB columns for "end time" (exit)
const END_TIME_CANDIDATES = [
  "exit_time",
  "exit_at",
  "ended_at",
  "end_time",
  "end_at",
  "checkout_time",
  "checkout_at",
];

const STATUS_CANDIDATES = ["status", "state", "session_status"];

function pickExistingKey(obj: any, keys: string[]) {
  if (!obj) return null;
  for (const k of keys) if (k in obj) return k;
  return null;
}

export async function GET() {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized", rows: [] }, { status: 401 });
    }

    const admin = supabaseAdmin();

    /**
     * IMPORTANT:
     * - sessions table likely has: id, created_at, user_id, game_id, players, slot_start, slot_end, status, ended_at...
     * - profiles table likely keyed by user_id
     * - games table likely keyed by id
     *
     * If your FK names differ, only the join aliases need adjusting.
     * This avoids selecting non-existing "exit_time" column.
     */
    const { data, error } = await admin
      .from("sessions")
      .select(`
        id,
        created_at,
        players,
        user_id,
        game_id,
        slot_start,
        slot_end,
        status,
        state,
        session_status,
        ended_at,
        exit_at,
        end_time,
        end_at,
        checkout_time,
        checkout_at,
        profiles:profiles!sessions_user_id_fkey (
          full_name,
          phone,
          email
        ),
        games:games!sessions_game_id_fkey (
          name
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message, rows: [] }, { status: 500 });
    }

    const rows = (data ?? []).map((r: any) => {
      const endCol = pickExistingKey(r, END_TIME_CANDIDATES);
      const statusCol = pickExistingKey(r, STATUS_CANDIDATES);

      return {
        id: r.id,
        created_at: r.created_at ?? null,

        full_name: r.profiles?.full_name ?? null,
        phone: r.profiles?.phone ?? null,
        email: r.profiles?.email ?? null,

        game_name: r.games?.name ?? null,
        players: r.players ?? null,

        slot_start: r.slot_start ?? null,
        slot_end: r.slot_end ?? null,

        status: statusCol ? r[statusCol] : null,

        // ✅ UI expects this name, but we derive it safely
        exit_time: endCol ? r[endCol] : null,
      };
    });

    return NextResponse.json({ rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error", rows: [] }, { status: 500 });
  }
}