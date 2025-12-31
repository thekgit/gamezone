import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    const patch: any = {};
    if (body.name != null) patch.name = String(body.name).trim();
    if (body.duration_minutes != null) patch.duration_minutes = Number(body.duration_minutes);
    if (body.court_count != null) patch.court_count = Number(body.court_count);
    if (body.price != null) patch.price = Number(body.price);
    if (body.is_active != null) patch.is_active = !!body.is_active;

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("games")
      .update(patch)
      .eq("id", id)
      .select("id, name, duration_minutes, court_count, price, is_active, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ game: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

// "Delete" = archive to avoid FK issues
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    const admin = supabaseAdmin();

    const { error } = await admin.from("games").update({ is_active: false }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}