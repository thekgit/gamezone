import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export async function GET() {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("games")
      .select("id, name, duration_minutes, courts, price")
      .order("name", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ games: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    const duration_minutes = Number(body?.duration_minutes ?? 60);
    const courts = Number(body?.courts ?? 1);
    const price = Number(body?.price ?? 0);

    if (!name) return NextResponse.json({ error: "Game name is required" }, { status: 400 });

    const admin = supabaseAdmin();
    const { error } = await admin.from("games").insert({
      name,
      duration_minutes,
      courts,
      price,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const patch: any = {
      name: String(body?.name || "").trim(),
      duration_minutes: Number(body?.duration_minutes ?? 60),
      courts: Number(body?.courts ?? 1),
      price: Number(body?.price ?? 0),
    };

    const admin = supabaseAdmin();
    const { error } = await admin.from("games").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}