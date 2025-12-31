import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (explicit) return explicit;

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return "";
}

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
    const siteUrl = getSiteUrl();

    if (!url || !service || !siteUrl) {
      return NextResponse.json(
        { error: "Missing env variables on Vercel." },
        { status: 500 }
      );
    }

    const admin = createClient(url, service, { auth: { persistSession: false } });

    // ✅ This is the IMPORTANT part:
    // invite link -> /auth/callback -> /auth/exchange -> /set-password -> /select
    const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(
      "/set-password?next=/select"
    )}`;

    const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });

    // If already exists in auth -> send reset password link with SAME redirect flow
    if (invErr) {
      const msg = (invErr.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        const { error: resetErr } = await admin.auth.resetPasswordForEmail(email, {
          redirectTo,
        });
        if (resetErr) return NextResponse.json({ error: resetErr.message }, { status: 500 });

        return NextResponse.json({
          ok: true,
          mode: "reset",
          message: "Account exists. Password reset link sent.",
        });
      }
      return NextResponse.json({ error: invErr.message }, { status: 500 });
    }

    const user_id = invited?.user?.id;
    if (!user_id) {
      return NextResponse.json({ error: "Invite created but user_id missing" }, { status: 500 });
    }

    // ✅ Upsert profile by email (because you have unique(email))
    const { error: pErr } = await admin
      .from("profiles")
      .upsert({ user_id, full_name, phone, email }, { onConflict: "email" });

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, mode: "invite" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}