import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

function getSiteUrl(req: Request) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  // fallback: use current request origin
  return new URL(req.url).origin;
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

    // generate secure token
    const exit_token = crypto.randomBytes(24).toString("hex");

    // store token on session
    const { error: upErr } = await admin
      .from("sessions")
      .update({ exit_token })
      .eq("id", session_id);

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const base = getSiteUrl(req);
    const exit_url = `${base}/exit?session_id=${encodeURIComponent(session_id)}&token=${encodeURIComponent(exit_token)}`;

    return NextResponse.json({ exit_url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}