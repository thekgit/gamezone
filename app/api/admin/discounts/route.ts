import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export async function POST(req: Request) {
  try {
    if (!(await assertAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const offer_date = String(body?.offer_date || "").trim();
    const offer_end_date = String(body?.offer_end_date || "").trim();
    const discount_percent = Number(body?.discount_percent ?? 0);
    const start_time = String(body?.start_time || "").trim();
    const end_time = String(body?.end_time || "").trim();

    if (!offer_date || !offer_end_date || !start_time || !end_time) {
      return NextResponse.json({ error: "All discount fields required" }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { error } = await admin.from("discounts_admin").insert({
      offer_date,
      offer_end_date,
      discount_percent,
      start_time,
      end_time,
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
      .from("discounts_admin")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rows: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}