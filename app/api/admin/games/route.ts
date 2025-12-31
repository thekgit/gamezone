import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    const timing_minutes = Number(body?.timing_minutes ?? 60);
    const courts = Number(body?.courts ?? 1);
    const price = Number(body?.price ?? 0);

    if (!name) return NextResponse.json({ error: "Game name required" }, { status: 400 });

    const admin = supabaseAdmin();
    const { error } = await admin.from("games_admin").insert({
      name,
      timing_minutes,
      courts,
      price,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("games_admin")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rows: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}