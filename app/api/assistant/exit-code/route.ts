import { NextResponse } from "next/server";
import { assertAssistant } from "@/lib/assertAssistant";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    if (!assertAssistant()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const session_id = String(body?.session_id || "").trim();
    if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

    const admin = supabaseAdmin();

    const { data: s, error: sErr } = await admin
      .from("sessions")
      .select("id, exit_token")
      .eq("id", session_id)
      .maybeSingle();

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    if (!s?.id) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    // Your public exit page expects: /exit?session_id=...&token=...
    const base =
      process.env.NEXT_PUBLIC_BASE_URL ||
      "https://k-e18b.vercel.app";

    const exit_url = `${base}/exit?session_id=${encodeURIComponent(session_id)}&token=${encodeURIComponent(
      String(s.exit_token || "")
    )}`;

    return NextResponse.json({ ok: true, exit_url }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}