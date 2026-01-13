import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function base64urlToString(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  return Buffer.from(s, "base64").toString("utf8");
}

function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function verifyToken(token: string, secret: string) {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false as const, error: "Invalid token format" };

  const [body, sig] = parts;
  const expected = base64url(crypto.createHmac("sha256", secret).update(body).digest());

  if (sig !== expected) {
    return { ok: false as const, error: "Invalid token signature" };
  }

  let payload: any;
  try {
    payload = JSON.parse(base64urlToString(body));
  } catch {
    return { ok: false as const, error: "Invalid token payload" };
  }

  if (!payload?.sid) return { ok: false as const, error: "Token missing sid" };
  if (!payload?.exp || typeof payload.exp !== "number")
    return { ok: false as const, error: "Token missing exp" };

  if (Date.now() > payload.exp) {
    return { ok: false as const, error: "Token expired" };
  }

  return { ok: true as const, payload };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const session_id = String(body?.session_id || "").trim();
    const token = String(body?.token || "").trim();

    if (!session_id || !token) {
      return NextResponse.json(
        { error: "Invalid QR (missing session_id/token)" },
        { status: 400 }
      );
    }

    const secret = process.env.EXIT_QR_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Missing EXIT_QR_SECRET in env" }, { status: 500 });
    }

    const v = verifyToken(token, secret);
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: 400 });
    }

    // Must match the session in token (prevents token reuse on other session ids)
    if (String(v.payload.sid) !== session_id) {
      return NextResponse.json({ error: "Invalid token for this session" }, { status: 400 });
    }

    // ✅ Identify the logged-in user from Authorization Bearer token
    const auth = req.headers.get("authorization") || "";
    const jwt = auth.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : "";

    if (!jwt) {
      // matches your old flow: user must be logged in; ExitClient redirects to login
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const { data: userRes, error: uErr } = await admin.auth.getUser(jwt);

    if (uErr || !userRes?.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const user_id = userRes.user.id;

    // ✅ Fetch session owner + current status
    const { data: s, error: sErr } = await admin
      .from("sessions")
      .select("id, user_id, ended_at, status")
      .eq("id", session_id)
      .single();

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    // ✅ Not your session protection (this is what you described)
    if (String(s.user_id || "") !== String(user_id)) {
      return NextResponse.json({ error: "Not your session" }, { status: 403 });
    }

    // Idempotent: if already ended, return ok
    const ended = !!s.ended_at || String(s.status || "").toLowerCase() === "ended";
    if (ended) {
      return NextResponse.json({ ok: true, alreadyEnded: true }, { status: 200 });
    }

    // ✅ End the session on scan (does not log out user)
    const { error: updErr } = await admin
      .from("sessions")
      .update({
        ended_at: new Date().toISOString(),
        status: "ended",
      })
      .eq("id", session_id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}