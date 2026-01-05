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
    if (!jwt) {
      return NextResponse.json({ error: "Missing Authorization token" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    // ✅ Validate token and get auth user
    const { data: ures, error: uerr } = await admin.auth.getUser(jwt);
    if (uerr || !ures?.user) {
      return NextResponse.json({ error: uerr?.message || "Invalid token" }, { status: 401 });
    }

    const user = ures.user;

    // 1) ✅ Try profile table first (source of truth for your app)
    // NOTE: Your profiles table must have columns:
    // id (uuid), must_change_password (bool), password_set (bool)
    const { data: prof, error: perr } = await admin
      .from("profiles")
      .select("id, must_change_password, password_set")
      .eq("id", user.id)
      .maybeSingle();

    if (perr) {
      // If profiles query fails (schema cache mismatch etc), still fallback to metadata
      const mustFromMeta = user.user_metadata?.must_change_password === true;
      return NextResponse.json({
        ok: true,
        user_id: user.id,
        must_change_password: mustFromMeta,
        password_set: !mustFromMeta,
        source: "metadata_fallback_profiles_error",
      });
    }

    if (prof) {
      const must = prof.must_change_password === true;
      const pset = prof.password_set === true;
      return NextResponse.json({
        ok: true,
        user_id: user.id,
        must_change_password: must || (!pset && must),
        password_set: pset,
        source: "profiles",
      });
    }

    // 2) ✅ If no profile row exists, fallback to metadata
    const mustFromMeta = user.user_metadata?.must_change_password === true;

    return NextResponse.json({
      ok: true,
      user_id: user.id,
      must_change_password: mustFromMeta,
      password_set: !mustFromMeta,
      source: "metadata",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

// ✅ When password gets set, mark it in profiles so it never loops again
export async function POST(req: Request) {
  try {
    const jwt = getBearer(req);
    if (!jwt) {
      return NextResponse.json({ error: "Missing Authorization token" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    const { data: ures, error: uerr } = await admin.auth.getUser(jwt);
    if (uerr || !ures?.user) {
      return NextResponse.json({ error: uerr?.message || "Invalid token" }, { status: 401 });
    }

    const user = ures.user;

    // Mark password set
    const { error: upErr } = await admin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          must_change_password: false,
          password_set: true,
        },
        { onConflict: "id" }
      );

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}