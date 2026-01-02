import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const exit_token = String(searchParams.get("exit_token") || "").trim();

    if (!exit_token) return NextResponse.json({ error: "Missing exit_token" }, { status: 400 });

    const admin = supabaseAdmin();
    const nowIso = new Date().toISOString();

    // ✅ end ALL sessions that share this exit_token, but only those not yet QR-ended
    const { error } = await admin
      .from("sessions")
      .update({ ended_at: nowIso, status: "ended" })
      .eq("exit_token", exit_token)
      .is("ended_at", null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, ended_at: nowIso });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}