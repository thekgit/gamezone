import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getOrigin(req: Request) {
  const url = new URL(req.url);
  return url.origin;
}

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const session_id = String(body?.session_id || "").trim();
    if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

    const admin = supabaseAdmin();

    // Ensure session exists + has exit_token
    const { data: s, error: sErr } = await admin
      .from("sessions")
      .select("id, status, exit_token")
      .eq("id", session_id)
      .single();

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    let exit_token = s.exit_token as string | null;

    if (!exit_token) {
      exit_token = crypto.randomUUID().replace(/-/g, "");
      const { error: uErr } = await admin
        .from("sessions")
        .update({ exit_token })
        .eq("id", session_id);
      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
    }

    // QR should open THIS route:
    const origin = getOrigin(req);
    const exit_url = `${origin}/api/visitor/exit?token=${exit_token}`;

    return NextResponse.json({ exit_url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}