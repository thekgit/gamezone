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

    const { session_id } = await req.json();
    if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

    const admin = supabaseAdmin();

    // 1) Fetch current token
    const { data: sess, error: sErr } = await admin
      .from("sessions")
      .select("id, exit_token")
      .eq("id", session_id)
      .single();

    if (sErr || !sess) return NextResponse.json({ error: sErr?.message || "Session not found" }, { status: 404 });

    // 2) Only generate if missing (IMPORTANT)
    let exit_token = sess.exit_token as string | null;
    if (!exit_token) {
      exit_token = crypto.randomBytes(24).toString("hex");

      const { error: uErr } = await admin
        .from("sessions")
        .update({ exit_token })
        .eq("id", session_id);

      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
    }

    const base = baseUrlFromEnv(req);
    const exit_url = `${base}/exit?sid=${encodeURIComponent(session_id)}&token=${encodeURIComponent(exit_token)}`;

    return NextResponse.json({ exit_url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}