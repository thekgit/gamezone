export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const exit_code = String(body?.exit_code || "");

    if (!exit_code) {
      return NextResponse.json({ error: "Missing exit code" }, { status: 400 });
    }

    // 🔐 Read logged-in user from Bearer token
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const user_id = userRes.user.id;

    // 🔎 Fetch session by exit_code
    const { data: session, error: sErr } = await admin
      .from("sessions")
      .select("id, user_id, status")
      .eq("exit_code", exit_code)
      .single();

    if (sErr || !session) {
      return NextResponse.json({ error: "Invalid or expired QR" }, { status: 400 });
    }

    if (session.status !== "active") {
      return NextResponse.json({ error: "Session already ended" }, { status: 400 });
    }

    // 🚫 CRITICAL CHECK
    if (session.user_id !== user_id) {
      return NextResponse.json(
        { error: "You are not allowed to end this session" },
        { status: 403 }
      );
    }

    // ✅ END SESSION
    const { error: endErr } = await admin
      .from("sessions")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
        exit_code: null, // invalidate QR
      })
      .eq("id", session.id);

    if (endErr) {
      return NextResponse.json({ error: endErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Session ended successfully" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}