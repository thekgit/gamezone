import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
    .from("games")
    .select("id, name, court_count, duration_minutes, price_rupees")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ games: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}