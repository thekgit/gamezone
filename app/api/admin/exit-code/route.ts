import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

function getBaseUrl(req: Request) {
  // 1) If you set NEXT_PUBLIC_SITE_URL on Vercel, use it (must be https://yourdomain.com)
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (explicit && !explicit.includes("localhost")) return explicit;

  // 2) Vercel provides the correct domain here (works for preview + prod)
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  // 3) Final fallback: derive from request
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { session_id } = await req.json();
    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // 1) Read existing token (don't regenerate each time)
    const { data: sess, error: sErr } = await admin
      .from("sessions")
      .select("id, exit_token")
      .eq("id", session_id)
      .single();

    if (sErr || !sess) {
      return NextResponse.json(
        { error: sErr?.message || "Session not found" },
        { status: 404 }
      );
    }

    // 2) Create token only if missing
    let exit_token = sess.exit_token as string | null;

    if (!exit_token) {
      exit_token = crypto.randomBytes(24).toString("hex");

      const { error: uErr } = await admin
        .from("sessions")
        .update({ exit_token })
        .eq("id", session_id);

      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
    }

    const baseUrl = getBaseUrl(req);
    const exit_url = `${baseUrl}/exit?token=${exit_token}`;

    return NextResponse.json({ exit_url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}