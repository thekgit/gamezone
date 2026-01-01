import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export async function GET() {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("games")
      .select("id, name, duration_minutes, court_count, price, is_active, created_at")
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
    const duration_minutes = Number(body?.duration_minutes || 60);
    const court_count = Number(body?.court_count || 1);
    const price = Number(body?.price || 0);

    if (!name) return NextResponse.json({ error: "Game name required" }, { status: 400 });

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("games")
      .insert({
        name,
        duration_minutes: Number.isFinite(duration_minutes) ? duration_minutes : 60,
        court_count: Number.isFinite(court_count) ? court_count : 1,
        price: Number.isFinite(price) ? price : 0,
        is_active: true,
      })
      .select("id, name, duration_minutes, court_count, price, is_active, created_at")
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
      const duration_minutes = Number(body?.duration_minutes || 60);
      const court_count = Number(body?.court_count || 1);
      const price = Number(body?.price || 0);
  
      if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
      if (!name) return NextResponse.json({ error: "Game name required" }, { status: 400 });
  
      const admin = supabaseAdmin();
      const { data, error } = await admin
        .from("games")
        .update({
          name,
          duration_minutes: Number.isFinite(duration_minutes) ? duration_minutes : 60,
          court_count: Number.isFinite(court_count) ? court_count : 1,
          price: Number.isFinite(price) ? price : 0,
        })
        .eq("id", id)
        .select("id, name, duration_minutes, court_count, price, is_active, created_at")
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
  
      // ✅ soft delete (keeps history)
      const { error } = await admin
        .from("games")
        .update({ is_active: false })
        .eq("id", id);
  
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
    }
  }