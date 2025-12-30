import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const full_name = (body?.full_name ?? "").trim();
    const phone = (body?.phone ?? "").trim();
    const email = (body?.email ?? "").trim().toLowerCase();

    if (!full_name || !phone || !email) {
      return NextResponse.json({ error: "Missing profile fields" }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Find auth user by email
    const { data: users, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

    const u = users.users.find((x) => (x.email || "").toLowerCase() === email);
    if (!u?.id) return NextResponse.json({ error: "Auth user not found" }, { status: 500 });

    // Upsert into profiles
    const { error } = await admin.from("profiles").upsert(
      [{ user_id: u.id, full_name, phone, email }],
      { onConflict: "email" }
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}