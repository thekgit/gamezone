import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const session_id = String(body?.session_id || "").trim();
    const token = String(body?.token || "").trim();

    if (!session_id || !token) {
      return NextResponse.json({ error: "Missing session_id or token" }, { status: 400 });
    }

    // user must be logged in
    const auth = req.headers.get("authorization") || "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!jwt) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const admin = supabaseAdmin();

    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    const user_id = userRes.user.id;

    // load session
    const { data: s, error: sErr } = await admin
      .from("sessions")
      .select("id, user_id, status, exit_token, ended_at")
      .eq("id", session_id)
      .single();

    if (sErr || !s?.id) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    // security checks
    if (s.user_id !== user_id) {
      return NextResponse.json({ error: "Not allowed (not your session)" }, { status: 403 });
    }
    if (String(s.exit_token || "") !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    // already ended
    if ((s.status || "").toLowerCase() === "ended" || s.ended_at) {
      return NextResponse.json({ ok: true, alreadyEnded: true });
    }

    const nowIso = new Date().toISOString();

    const { error: upErr } = await admin
      .from("sessions")
      .update({
        status: "ended",
        ended_at: nowIso,      // exact scan time
        end_time: nowIso,
        ends_at: nowIso,
      })
      .eq("id", session_id);

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}