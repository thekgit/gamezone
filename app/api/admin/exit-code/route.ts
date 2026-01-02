import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function token(len = 12) {
  return crypto.randomBytes(len).toString("hex");
}

function getBaseUrl(req: Request) {
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const session_id = String(body?.session_id || "").trim();
    if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

    const admin = supabaseAdmin();

    // rotate token every time
    const newExitToken = token(12);

    const { data: s, error: upErr } = await admin
      .from("sessions")
      .update({ exit_token: newExitToken })
      .eq("id", session_id)
      .select("id, exit_token")
      .single();

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const base = getBaseUrl(req);

    // QR opens exit page with sid + token
    const exit_url = `${base}/exit?session_id=${encodeURIComponent(s.id)}&token=${encodeURIComponent(
      s.exit_token
    )}`;

    return NextResponse.json({ ok: true, exit_url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}