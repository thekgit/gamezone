import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/assertAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import crypto from "crypto";

function makeCode() {
  return crypto.randomBytes(16).toString("hex");
}

export async function POST(req: Request) {
  const ok = await assertAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { session_id } = await req.json();
  if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

  const admin = supabaseAdmin();
  const code = makeCode();

  // We store the code in exit_token (overwrite old -> prevents reuse/scam)
  const { error } = await admin
    .from("sessions")
    .update({ exit_token: code })
    .eq("id", session_id)
    .eq("status", "active");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const exit_url = `http://localhost:3000/exit?code=${code}`;
  return NextResponse.json({ ok: true, exit_url, code });
}