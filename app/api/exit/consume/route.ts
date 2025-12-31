import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function POST(req: Request) {
  const { token } = await req.json();
  const auth = req.headers.get("authorization") || "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token || !jwt) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();

  const { data: userRes } = await admin.auth.getUser(jwt);
  if (!userRes?.user?.id) {
    return NextResponse.json({ error: "Invalid user" }, { status: 401 });
  }

  const userId = userRes.user.id;

  const { data: session } = await admin
    .from("sessions")
    .select("*")
    .eq("exit_token", token)
    .eq("status", "active")
    .single();

  if (!session) {
    return NextResponse.json({ error: "Invalid or expired QR" }, { status: 400 });
  }

  // 🔒 Only SAME user can end
  if (session.user_id !== userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  await admin
    .from("sessions")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      exit_token: null,
    })
    .eq("id", session.id);

  return NextResponse.json({ ok: true });
}