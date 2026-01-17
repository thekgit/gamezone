import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isoNow() {
  return new Date().toISOString();
}

function ms(iso?: string | null) {
  if (!iso) return NaN;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const session_id = String(body?.session_id || "").trim();
    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // 1) Read current session (we also need ends_at to detect “clamp” behavior)
    const { data: s0, error: e0 } = await admin
      .from("sessions")
      .select("id, status, ended_at, ends_at")
      .eq("id", session_id)
      .single();

    if (e0) return NextResponse.json({ error: e0.message }, { status: 500 });
    if (!s0) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const st0 = String(s0.status || "").toLowerCase();
    if (s0.ended_at || st0 === "ended" || st0 === "completed") {
      return NextResponse.json(
        { ok: true, ended_at: s0.ended_at, already_ended: true },
        { status: 200 }
      );
    }

    // 2) Try to end with exact click time
    const clickedAt = isoNow();

    const { error: u1 } = await admin
      .from("sessions")
      .update({
        ended_at: clickedAt,
        status: "ended",
      })
      .eq("id", session_id);

    if (u1) return NextResponse.json({ error: u1.message }, { status: 500 });

    // 3) Re-read to confirm what actually got stored (detect triggers/clamps)
    const { data: s1, error: e1 } = await admin
      .from("sessions")
      .select("id, status, ended_at, ends_at")
      .eq("id", session_id)
      .single();

    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
    if (!s1) return NextResponse.json({ error: "Session disappeared" }, { status: 500 });

    const ended1 = s1.ended_at ?? null;

    // If DB forced ended_at to ends_at, it will be exactly ends_at (or very close)
    const endedMs = ms(ended1);
    const endsMs = ms(s1.ends_at ?? null);
    const clickMs = ms(clickedAt);

    const looksClampedToEndsAt =
      Number.isFinite(endedMs) &&
      Number.isFinite(endsMs) &&
      Math.abs(endedMs - endsMs) <= 1500 && // ~1.5s
      Number.isFinite(clickMs) &&
      Math.abs(endedMs - clickMs) > 30_000; // differs from click by >30s

    if (!looksClampedToEndsAt) {
      // success: ended_at matches click time (or at least not clamped)
      return NextResponse.json(
        { ok: true, ended_at: ended1, forced_fix: false },
        { status: 200 }
      );
    }

    // 4) Fallback: also update ends_at to clickedAt so clamp logic becomes click time
    // This is the only reliable way if a DB trigger uses LEAST(now, ends_at)
    const { error: u2 } = await admin
      .from("sessions")
      .update({
        ends_at: clickedAt,
        ended_at: clickedAt,
        status: "ended",
      })
      .eq("id", session_id);

    if (u2) return NextResponse.json({ error: u2.message }, { status: 500 });

    const { data: s2, error: e2 } = await admin
      .from("sessions")
      .select("id, status, ended_at, ends_at")
      .eq("id", session_id)
      .single();

    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

    return NextResponse.json(
      {
        ok: true,
        ended_at: s2?.ended_at ?? clickedAt,
        forced_fix: true,
        note: "DB looked like it was clamping ended_at to ends_at; ends_at was set to click time to preserve the click-time exit.",
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}