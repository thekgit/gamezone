import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { full_name, phone, email } = await req.json();

    if (!full_name || !phone || !email) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    // 1️⃣ Create auth user (magic link)
    const { data: authRes, error: authErr } =
      await admin.auth.admin.createUser({
        email,
        email_confirm: false,
      });

    if (authErr || !authRes?.user?.id) {
      return NextResponse.json(
        { error: authErr?.message || "Auth user creation failed" },
        { status: 500 }
      );
    }

    const user_id = authRes.user.id;

    // 2️⃣ Create profile (IMPORTANT)
    const { error: profileErr } = await admin.from("profiles").insert({
      user_id,
      full_name,
      phone,
      email,
    });

    if (profileErr) {
      return NextResponse.json(
        { error: profileErr.message },
        { status: 500 }
      );
    }

    // 3️⃣ Send invite email
    await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}