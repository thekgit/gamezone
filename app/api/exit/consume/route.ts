import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function msToHuman(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export async function POST(req: Request) {
  try {
    const { token } = await req.json().catch(() => ({}));
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // user auth via Bearer
    const auth = req.headers.get("authorization") || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!bearer) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const admin = supabaseAdmin();

    // resolve user
    const { data: userRes, error: userErr } = await admin.auth.getUser(bearer);
    const user_id = userRes?.user?.id;
    if (userErr || !user_id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    // find session by exit_token
    const { data: sess, error: sErr } = await admin
      .from("sessions")
      .select("id, user_id, status, started_at, start_time, created_at, ended_at, end_time")
      .eq("exit_token", token)
      .maybeSingle();

    if (sErr || !sess) return NextResponse.json({ error: "Invalid/expired QR." }, { status: 400 });

    // ✅ only the same user can end
    if (sess.user_id !== user_id) {
      return NextResponse.json({ error: "This QR is not for your session." }, { status: 403 });
    }

    // If already ended
    if (sess.status === "ended") {
      return NextResponse.json({ ok: true, played: "0s", message: "Already ended" });
    }

    const now = new Date();
    const started =
      (sess.start_time && new Date(sess.start_time)) ||
      (sess.started_at && new Date(sess.started_at)) ||
      (sess.created_at && new Date(sess.created_at)) ||
      now;

    const played = msToHuman(now.getTime() - started.getTime());

    const { error: uErr } = await admin
      .from("sessions")
      .update({
        status: "ended",
        ended_at: now.toISOString(),
        end_time: now.toISOString(),
      })
      .eq("id", sess.id);

    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, played });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}