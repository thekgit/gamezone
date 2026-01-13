import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const session_id = String(body?.session_id || "").trim();

    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // ✅ Use ONLY columns that exist in your sessions table (based on your working visitors route)
    const { data: s, error } = await admin
      .from("sessions")
      .select("id, ended_at, status")
      .eq("id", session_id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    // Don’t generate QR for ended sessions
    if (s.ended_at || String(s.status || "").toLowerCase() === "ended") {
      return NextResponse.json({ error: "Session already ended" }, { status: 400 });
    }

    // ✅ Build exit URL robustly
    const base =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "";

    if (!base) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SITE_URL (or NEXT_PUBLIC_APP_URL)" },
        { status: 500 }
      );
    }

    const exit_url =
      `${base.replace(/\/$/, "")}/exit?session_id=${encodeURIComponent(session_id)}`;

    return NextResponse.json({ exit_url }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}