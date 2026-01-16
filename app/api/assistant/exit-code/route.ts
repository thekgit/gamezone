import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAssistant } from "@/lib/assertAssistant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function mkToken(len = 16) {
  return crypto.randomBytes(len).toString("hex");
}

function originFromReq(req: Request) {
  // Works on Vercel + local
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host");
  if (host) return `${proto}://${host}`;
  // fallback
  return "https://k-e18b.vercel.app";
}

export async function POST(req: Request) {
  try {
    if (!(await assertAssistant())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const session_id = String(body?.session_id || "").trim();
    if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

    const admin = supabaseAdmin();

    // 1) read existing token
    const { data: sess, error: sErr } = await admin
      .from("sessions")
      .select("id, exit_token")
      .eq("id", session_id)
      .maybeSingle();

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    if (!sess?.id) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    let exit_token = String(sess.exit_token || "").trim();

    // 2) ensure token exists
    if (!exit_token) {
      exit_token = mkToken(16);
      const { error: uErr } = await admin
        .from("sessions")
        .update({ exit_token })
        .eq("id", session_id);

      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
    }

    const base = originFromReq(req);
    const exit_url = `${base}/exit?session_id=${encodeURIComponent(session_id)}&token=${encodeURIComponent(
      exit_token
    )}`;

    return NextResponse.json({ ok: true, exit_url }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}