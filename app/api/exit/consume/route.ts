import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();

    if (!token) {
      return NextResponse.json({ error: "Invalid QR (missing info)." }, { status: 400 });
    }

    // ✅ Require user login (only the same user can end)
    const auth = req.headers.get("authorization") || "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!jwt) {
      return NextResponse.json({ error: "NOT_LOGGED_IN" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    const userId = userRes?.user?.id;

    if (userErr || !userId) {
      return NextResponse.json({ error: "Invalid session. Please login again." }, { status: 401 });
    }

    // ✅ Find ACTIVE session by token
    const { data: sess, error: sErr } = await admin
      .from("sessions")
      .select("id, user_id, status, started_at, start_time, created_at")
      .eq("exit_token", token)
      .eq("status", "active")
      .maybeSingle();

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

    if (!sess?.id) {
      return NextResponse.json({ error: "Invalid/expired QR." }, { status: 400 });
    }

    // ✅ Only the SAME booking user can end the session
    if (sess.user_id !== userId) {
      return NextResponse.json({ error: "This QR is not for your session." }, { status: 403 });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    const startIso =
      (sess.started_at as string | null) ||
      (sess.start_time as string | null) ||
      (sess.created_at as string | null) ||
      nowIso;

    const durationMs = Math.max(0, now.getTime() - new Date(startIso).getTime());
    const durationMinutes = Math.round(durationMs / 60000);

    // ✅ End session + invalidate token immediately (so QR can’t be reused)
    const { error: uErr } = await admin
      .from("sessions")
      .update({
        status: "ended",
        ended_at: nowIso,
        end_time: nowIso,
        ends_at: nowIso,
        exit_token: null, // important: invalidate QR
      } as any)
      .eq("id", sess.id);

    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      durationMinutes,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}