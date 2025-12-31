import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { full_name, phone, email } = body;

    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const admin = supabaseAdmin();
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const user_id = userRes.user.id;

    const { error: pErr } = await admin
      .from("profiles")
      .upsert(
        {
          user_id,
          full_name: full_name ?? null,
          phone: phone ?? null,
          email: email ?? null,
        },
        { onConflict: "user_id" }
      );

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}