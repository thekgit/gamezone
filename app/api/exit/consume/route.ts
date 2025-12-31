import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { sid, token } = await req.json().catch(() => ({}));

    if (!sid || !token) {
      return NextResponse.json({ error: "Missing sid/token" }, { status: 400 });
    }

    const auth = req.headers.get("authorization") || "";
    const access = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!access) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    // Get user from access token
    const { data: userRes, error: userErr } = await admin.auth.getUser(access);
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    const user_id = userRes.user.id;

    // Session must match sid + token + active
    const { data: sess, error: sErr } = await admin
      .from("sessions")
      .select("id, user_id, status, exit_token")
      .eq("id", sid)
      .single();

    if (sErr || !sess) return NextResponse.json({ error: "Invalid/expired QR" }, { status: 400 });

    if (sess.exit_token !== token) return NextResponse.json({ error: "Invalid/expired QR" }, { status: 400 });

    if (sess.user_id !== user_id) return NextResponse.json({ error: "Not your session" }, { status: 403 });

    if (sess.status !== "active") return NextResponse.json({ error: "Session already ended" }, { status: 400 });

    const now = new Date().toISOString();

    const { error: uErr } = await admin
      .from("sessions")
      .update({ status: "ended", ended_at: now })
      .eq("id", sid);

    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}