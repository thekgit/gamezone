import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * IMPORTANT:
 * Your UI expects `exit_time` and `status`, but your DB columns differ.
 * So we:
 * 1) Fetch the row with '*' (admin/service role can do this)
 * 2) Detect the real end-time column from common possibilities
 * 3) Update that real column safely
 *
 * This prevents "column does not exist" mistakes permanently.
 */

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

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const session_id = String(body?.session_id || "").trim();
    const slot_end_from_ui = body?.slot_end ? String(body.slot_end) : null;

    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // ✅ Fetch full row so we can detect real column names
    const { data: row, error: fetchErr } = await admin
      .from("sessions")
      .select("*")
      .eq("id", session_id)
      .single();

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    // Detect actual end time column + status column
    const endTimeCol = pickExistingKey(row, END_TIME_CANDIDATES);
    const statusCol = pickExistingKey(row, STATUS_CANDIDATES);

    if (!endTimeCol) {
      return NextResponse.json(
        { error: "No end-time column found in sessions table (exit_time/ended_at/etc.)" },
        { status: 500 }
      );
    }

    // Already ended? idempotent
    const existingEnd = row[endTimeCol];
    const existingStatus = statusCol ? String(row[statusCol] || "").toLowerCase() : "";
    if (existingEnd || existingStatus === "ended" || existingStatus === "completed") {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Compute exit time = min(now, slot_end)
    const now = new Date();
    let exit = now;

    if (slot_end_from_ui) {
      const slotEnd = new Date(slot_end_from_ui);
      if (!isNaN(slotEnd.getTime())) {
        exit = now > slotEnd ? slotEnd : now;
      }
    }

    const payload: Record<string, any> = {
      [endTimeCol]: exit.toISOString(),
    };

    // If there is a status column, update it too
    if (statusCol) payload[statusCol] = "ended";

    const { error: updErr } = await admin
      .from("sessions")
      .update(payload)
      .eq("id", session_id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}