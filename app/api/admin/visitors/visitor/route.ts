import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = String(url.searchParams.get("token") || "").trim();

    if (!token) {
      return new NextResponse("Missing token", {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const admin = supabaseAdmin();

    // Find session by exit_token
    const { data: s, error: sErr } = await admin
      .from("sessions")
      .select("id, status, ended_at")
      .eq("exit_token", token)
      .single();

    if (sErr) {
      return new NextResponse(sErr.message, {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      });
    }

    if (!s?.id) {
      return new NextResponse("Invalid token", {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Already ended
    if (s.ended_at) {
      return new NextResponse("Session already closed ✅", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // End it now
    const nowIso = new Date().toISOString();

    const { error: uErr } = await admin
      .from("sessions")
      .update({
        status: "ended",
        ended_at: nowIso, // ✅ REAL column in your DB
      })
      .eq("id", s.id);

    if (uErr) {
      return new NextResponse(uErr.message, {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      });
    }

    return new NextResponse("Session closed ✅", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (e: any) {
    return new NextResponse(e?.message || "Server error", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}