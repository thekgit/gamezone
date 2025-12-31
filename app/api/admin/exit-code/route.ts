import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

function baseUrlFromEnv(req: Request) {
  // Prefer explicit env
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

  // Fallback for Vercel
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  // Last fallback (local)
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { session_id } = await req.json().catch(() => ({}));
    if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

    const admin = supabaseAdmin();

    // ✅ Always generate a NEW token (so old QR becomes invalid)
    const exit_token = crypto.randomBytes(24).toString("hex");

    const { error: uErr } = await admin
  .from("sessions")
  .update({
    exit_token, // ✅ ONLY this
  })
  .eq("id", session_id);

    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

    const base = baseUrlFromEnv(req);
    const exit_url = `${base}/exit?token=${encodeURIComponent(exit_token)}`;

    return NextResponse.json({ exit_url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}