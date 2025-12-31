import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export async function GET() {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("discounts")
      .select("id, game_id, offer_date, offer_end_date, discount_percent, discount_start_time, discount_end_time, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ discounts: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const payload = {
      game_id: body?.game_id ?? null,
      offer_date: String(body?.offer_date || ""),
      offer_end_date: String(body?.offer_end_date || ""),
      discount_percent: Number(body?.discount_percent ?? 0),
      discount_start_time: String(body?.discount_start_time || ""),
      discount_end_time: String(body?.discount_end_time || ""),
    };

    if (!payload.offer_date || !payload.offer_end_date) {
      return NextResponse.json({ error: "Offer date and end date required" }, { status: 400 });
    }
    if (!payload.discount_start_time || !payload.discount_end_time) {
      return NextResponse.json({ error: "Discount start and end time required" }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { error } = await admin.from("discounts").insert(payload);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
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
    const { error } = await admin.from("discounts").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}