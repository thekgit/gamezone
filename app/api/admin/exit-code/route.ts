import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function POST(req: Request) {
  const { session_id } = await req.json();

  if (!session_id) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  const exit_code = crypto.randomUUID();

  const admin = supabaseAdmin();

  const { error } = await admin
    .from("sessions")
    .update({
      exit_token: exit_code,
      status: "active",
    })
    .eq("id", session_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ✅ THIS IS THE IMPORTANT PART
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://k-e18b.vercel.app"; // fallback safety

  return NextResponse.json({
    exit_url: `${baseUrl}/exit?code=${exit_code}`,
  });
}