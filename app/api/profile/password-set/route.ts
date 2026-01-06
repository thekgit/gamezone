import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || "";
}

export async function GET(req: Request) {
  try {
    const jwt = getBearer(req);
    if (!jwt) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const admin = supabaseAdmin();

    // 1) Resolve user from JWT
    const { data: authRes, error: authErr } = await admin.auth.getUser(jwt);
    if (authErr || !authRes?.user) {
      return NextResponse.json({ error: authErr?.message || "Invalid session" }, { status: 401 });
    }

    const user = authRes.user;
    const user_id = user.id;
    const email = user.email ?? null;

    // 2) Fallback from metadata (works if you set it during create/import)
    const metaMustChange = user.user_metadata?.must_change_password === true;

    // 3) PRIMARY SOURCE: profiles table (your PK is user_id)
    //    profiles columns you showed:
    //    user_id (PK), full_name NOT NULL, phone NOT NULL, email NOT NULL,
    //    must_change_password (nullable, default false), password_set NOT NULL default true
    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("user_id, must_change_password, password_set")
      .eq("user_id", user_id)
      .maybeSingle();

    // If profiles lookup fails, don't break login; use metadata fallback
    if (profErr) {
      return NextResponse.json({
        ok: true,
        user_id,
        email,
        // if we cannot read profiles, safest is to rely on metadata
        must_change_password: metaMustChange,
        source: "metadata_fallback",
      });
    }

    // If no profile row exists:
    // - signup users may not have profile row yet (depending on your app)
    // - in that case: use metadata fallback (usually false)
    if (!prof?.user_id) {
      return NextResponse.json({
        ok: true,
        user_id,
        email,
        must_change_password: metaMustChange,
        source: "no_profile_row",
      });
    }

    const profMustChange = prof.must_change_password === true;
    const password_set = prof.password_set; // boolean NOT NULL in your schema

    // ✅ final decision:
    // If password_set is false => must change
    // OR if must_change_password is true => must change
    const must_change_password = profMustChange || password_set === false;

    return NextResponse.json({
      ok: true,
      user_id,
      email,
      must_change_password,
      password_set,
      source: "profiles",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}