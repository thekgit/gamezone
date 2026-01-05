import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE env vars");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || "";
}

async function getAuthedUser(req: Request) {
  const token = bearer(req);
  if (!token) return { user: null, token: "" };

  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error) return { user: null, token: "" };
  return { user: data.user || null, token };
}

export async function GET(req: Request) {
  try {
    const { user } = await getAuthedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = supabaseAdmin();

    // 1) Check user_metadata flag (this is what your Admin import/manual create sets)
    const metaMust =
      user.user_metadata?.must_change_password === true ||
      user.user_metadata?.must_change_password === "true";

    // 2) Also check profiles table flags if you use them for signup/email-link flow
    let profileMust = false;
    let passwordSet = true;

    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("must_change_password,password_set")
      .eq("id", user.id)
      .maybeSingle();

    // If profiles row doesn't exist yet, treat as "password not set" only for email-link users.
    // But DO NOT break old flow: metaMust already covers Admin-created users.
    if (!profErr && prof) {
      profileMust = prof.must_change_password === true;
      if (typeof prof.password_set === "boolean") passwordSet = prof.password_set;
    }

    return NextResponse.json({
      ok: true,
      must_change_password: metaMust || profileMust,
      password_set: passwordSet,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await getAuthedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = supabaseAdmin();

    // Mark profile flags
    await admin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email || null,
          must_change_password: false,
          password_set: true,
        },
        { onConflict: "id" }
      );

    // ALSO clear metadata flag so next login won't force set-password
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata || {}),
        must_change_password: false,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}