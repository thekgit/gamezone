import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = String(url.searchParams.get("token") || "").trim();

    if (!token) {
      return new NextResponse("Missing token", { status: 400 });
    }

    // Find session by exit_token
    const { data: s, error: sErr } = await supabase
      .from("sessions")
      .select("id, status, ended_at")
      .eq("exit_token", token)
      .single();

    if (sErr) return new NextResponse(sErr.message, { status: 500 });
    if (!s) return new NextResponse("Invalid token", { status: 404 });

    // If already ended, just show success
    if (s.ended_at) {
      return new NextResponse("Session already closed ✅", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Mark ended
    const now = new Date().toISOString();

    const { error: uErr } = await supabase
      .from("sessions")
      .update({
        status: "ended",
        ended_at: now, // ✅ this exists in your DB
      })
      .eq("id", s.id);

    if (uErr) return new NextResponse(uErr.message, { status: 500 });

    return new NextResponse("Session closed ✅", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (e: any) {
    return new NextResponse(e?.message || "Server error", { status: 500 });
  }
}