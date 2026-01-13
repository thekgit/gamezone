import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// possible DB column names for end-time + status
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
    // If your current sessions API is not admin-protected, remove this check.
    // But since it’s admin dashboard, it should be protected.
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized", rows: [] }, { status: 401 });
    }

    const admin = supabaseAdmin();

    // ✅ IMPORTANT: do NOT select exit_time/slot_end etc. unless they truly exist
    // Fetch base columns that you know exist OR just fetch '*' to avoid mistakes.
    const { data, error } = await admin
      .from("sessions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message, rows: [] }, { status: 500 });
    }

    const rows = (data ?? []).map((r: any) => {
      const endCol = pickExistingKey(r, END_TIME_CANDIDATES);
      const statusCol = pickExistingKey(r, STATUS_CANDIDATES);

      // ✅ normalize to what your frontend expects
      return {
        id: r.id,
        created_at: r.created_at ?? null,

        full_name: r.full_name ?? r.name ?? null,
        phone: r.phone ?? null,
        email: r.email ?? null,

        game_name: r.game_name ?? r.game ?? null,
        players: r.players ?? null,

        // These may already exist in your table or may be computed elsewhere.
        // Keep them if present, otherwise null.
        slot_start: r.slot_start ?? null,
        slot_end: r.slot_end ?? null,

        status: statusCol ? r[statusCol] : (r.status ?? null),

        // ✅ the key fix: compute exit_time from real DB column
        exit_time: endCol ? r[endCol] : null,
      };
    });

    return NextResponse.json({ rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error", rows: [] }, { status: 500 });
  }
}