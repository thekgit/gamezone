import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAssistant } from "@/lib/assertAssistant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function originFromReq(req: Request) {
  const o = req.headers.get("origin");
  if (o) return o;
  const host = req.headers.get("host");
  return host ? `https://${host}` : "";
}

export async function POST(req: Request) {
  try {
    if (!assertAssistant()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const session_id = String(body?.session_id || "").trim();
    if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

    const admin = supabaseAdmin();

    // IMPORTANT: your QR exit flow expects session_id + token
    const { data: s, error } = await admin
      .from("sessions")
      .select("id, exit_token, ended_at, status")
      .eq("id", session_id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    // don't generate QR for ended session
    const st = String(s.status || "").toLowerCase();
    if (s.ended_at || st === "ended" || st === "completed") {
      return NextResponse.json({ error: "Session already ended" }, { status: 409 });
    }

    if (!s.exit_token) return NextResponse.json({ error: "exit_token missing on session" }, { status: 500 });

    const origin = originFromReq(req);
    if (!origin) return NextResponse.json({ error: "Cannot determine site origin" }, { status: 500 });

    const exit_url = `${origin}/exit?session_id=${encodeURIComponent(s.id)}&token=${encodeURIComponent(
      String(s.exit_token)
    )}`;

    return NextResponse.json({ ok: true, exit_url }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}