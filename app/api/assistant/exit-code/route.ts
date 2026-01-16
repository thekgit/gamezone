import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAssistant } from "@/lib/assertAssistant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signToken(payload: any, secret: string) {
  const body = base64url(JSON.stringify(payload));
  const sig = base64url(crypto.createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

export async function POST(req: Request) {
  try {
    if (!(await assertAssistant())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const session_id = String(body?.session_id || "").trim();
    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const secret = process.env.EXIT_QR_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Missing EXIT_QR_SECRET in env" }, { status: 500 });
    }

    const base =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "";
    if (!base) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SITE_URL (or NEXT_PUBLIC_APP_URL) in env" },
        { status: 500 }
      );
    }

    // optional safety: don’t generate for ended sessions
    const admin = supabaseAdmin();
    const { data: s, error: sErr } = await admin
      .from("sessions")
      .select("id, ended_at, status")
      .eq("id", session_id)
      .single();

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const ended = !!s.ended_at || String(s.status || "").toLowerCase() === "ended";
    if (ended) {
      return NextResponse.json({ error: "Session already ended" }, { status: 400 });
    }

    // new random token every click -> new QR every time
    const tokenPayload = {
      sid: session_id,
      nonce: crypto.randomBytes(16).toString("hex"),
      exp: Date.now() + 1000 * 60 * 30,
    };

    const token = signToken(tokenPayload, secret);

    const exit_url =
      `${base.replace(/\/$/, "")}/exit?session_id=${encodeURIComponent(session_id)}` +
      `&token=${encodeURIComponent(token)}`;

    return NextResponse.json({ exit_url }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}