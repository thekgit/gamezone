import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function makeUniqueKey(admin: ReturnType<typeof supabaseAdmin>, base: string) {
  // Try base, then base-2, base-3, ...
  let key = base || "game";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? key : `${key}-${i + 1}`;

    const { data, error } = await admin
      .from("games")
      .select("id")
      .eq("key", candidate)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data?.id) return candidate; // available
  }
  // last resort
  return `${key}-${Date.now()}`;
}

export async function GET() {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("games")
      .select("id, key, name, duration_minutes, court_count, price, is_active, created_at")
      .order("created_at", { ascending: false });

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

    // accept both names (your UI sends timing_minutes / courts)
    const duration_minutes = Number(body?.duration_minutes ?? body?.timing_minutes ?? 60);
    const court_count = Number(body?.court_count ?? body?.courts ?? 1);
    const price = Number(body?.price ?? 0);

    if (!name) return NextResponse.json({ error: "Game name required" }, { status: 400 });

    const admin = supabaseAdmin();

    // ✅ generate required "key" column
    const baseKey = slugify(name);
    const key = await makeUniqueKey(admin, baseKey);

    const { data, error } = await admin
      .from("games")
      .insert({
        key, // ✅ FIX
        name,
        duration_minutes: Number.isFinite(duration_minutes) ? duration_minutes : 60,
        court_count: Number.isFinite(court_count) ? court_count : 1,
        price_rupees: Number.isFinite(price) ? price : 0,
        is_active: true,
      })
      .select("id, key, name, duration_minutes, court_count, price, is_active, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ game: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();

    const name = String(body?.name || "").trim();
    const duration_minutes = Number(body?.duration_minutes ?? body?.timing_minutes ?? 60);
    const court_count = Number(body?.court_count ?? body?.courts ?? 1);
    const price = Number(body?.price ?? 0);

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    if (!name) return NextResponse.json({ error: "Game name required" }, { status: 400 });

    const admin = supabaseAdmin();

    // ✅ if name changed, update key too (keeps legacy compatibility)
    const baseKey = slugify(name);
    const key = await makeUniqueKey(admin, baseKey);

    const { data, error } = await admin
      .from("games")
      .update({
        key,
        name,
        duration_minutes: Number.isFinite(duration_minutes) ? duration_minutes : 60,
        court_count: Number.isFinite(court_count) ? court_count : 1,
        price_rupees: Number.isFinite(price) ? price : 0,
      })
      .eq("id", id)
      .select("id, key, name, duration_minutes, court_count, price_rupees, is_active, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ game: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const admin = supabaseAdmin();

    // soft delete
    const { error } = await admin.from("games").update({ is_active: false }).eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}