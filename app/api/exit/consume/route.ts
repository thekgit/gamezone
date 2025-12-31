import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { session_id, token } = await req.json().catch(() => ({}));

    if (!session_id || !token) {
      return NextResponse.json({ error: "Missing session_id or token" }, { status: 400 });
    }

    const auth = req.headers.get("authorization") || "";
    const access_token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!access_token) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    // get logged-in user from access token
    const { data: userRes, error: userErr } = await admin.auth.getUser(access_token);
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    const user_id = userRes.user.id;

    // load session
    const { data: s, error: sErr } = await admin
      .from("sessions")
      .select("id, user_id, status, exit_token")
      .eq("id", session_id)
      .single();

    if (sErr || !s) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    if (s.status !== "active") {
      return NextResponse.json({ error: "Already ended" }, { status: 400 });
    }

    if (s.user_id !== user_id) {
      return NextResponse.json({ error: "This QR is not for your account" }, { status: 403 });
    }

    if (!s.exit_token || s.exit_token !== token) {
      return NextResponse.json({ error: "Invalid/expired QR" }, { status: 400 });
    }

    // end it now
    const now = new Date().toISOString();
    const { error: endErr } = await admin
      .from("sessions")
      .update({
        status: "ended",
        ended_at: now,
        end_time: now,
        ends_at: now,
      })
      .eq("id", session_id);

    if (endErr) return NextResponse.json({ error: endErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}