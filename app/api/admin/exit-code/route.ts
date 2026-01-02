import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const group_id = String(body?.group_id || "").trim();
    const session_id = String(body?.session_id || "").trim(); // backward compatible

    if (!group_id && !session_id) {
      return NextResponse.json({ error: "Missing group_id or session_id" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // resolve exit_token by group_id (preferred) else by session_id
    let exit_token = "";

    if (group_id) {
      const { data: s } = await admin
        .from("sessions")
        .select("exit_token")
        .eq("group_id", group_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      exit_token = s?.exit_token || "";
    } else {
      const { data: s } = await admin.from("sessions").select("exit_token").eq("id", session_id).maybeSingle();
      exit_token = s?.exit_token || "";
    }

    if (!exit_token) return NextResponse.json({ error: "Exit token missing" }, { status: 400 });

    const base = process.env.NEXT_PUBLIC_BASE_URL || "";
    const exit_url = `${base}/visitor?exit_token=${exit_token}`;

    return NextResponse.json({ exit_url, exit_token });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}