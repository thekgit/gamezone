import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const full_name = String(body?.full_name || "").trim();
    const phone = String(body?.phone || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

    if (!url || !service || !siteUrl) {
      return NextResponse.json(
        {
          error:
            "Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SITE_URL (or VERCEL_URL)",
        },
        { status: 500 }
      );
    }

    const admin = createClient(url, service, { auth: { persistSession: false } });

    // ✅ 1) If profile already exists with this email, treat as "already registered"
    const { data: existingProfile, error: existErr } = await admin
      .from("profiles")
      .select("user_id, email")
      .eq("email", email)
      .maybeSingle();

    // if the table query itself fails
    if (existErr) {
      return NextResponse.json({ error: existErr.message }, { status: 500 });
    }

    if (existingProfile?.email) {
      return NextResponse.json(
        { error: "User already exists. Please login." },
        { status: 409 }
      );
    }

    const redirectTo = `${siteUrl}/auth/callback?next=/set-password`;

    // ✅ 2) Invite user
    const { data: invited, error: invErr } =
      await admin.auth.admin.inviteUserByEmail(email, { redirectTo });

    if (invErr) {
      const msg = (invErr.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        return NextResponse.json(
          { error: "User already exists. Please login." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: invErr.message }, { status: 500 });
    }

    const user_id = invited?.user?.id;
    if (!user_id) {
      return NextResponse.json(
        { error: "Invite created but user_id missing" },
        { status: 500 }
      );
    }

    // ✅ 3) Upsert using EMAIL as conflict key (because your DB has unique(email))
    const { error: pErr } = await admin.from("profiles").upsert(
      { user_id, full_name, phone, email },
      { onConflict: "email" }
    );

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}