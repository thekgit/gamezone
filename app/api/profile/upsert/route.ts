import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  if (!h.toLowerCase().startsWith("bearer ")) return "";
  return h.slice(7).trim();
}

export async function POST(req: Request) {
  try {
    const token = getBearer(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized (missing token)" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const full_name = String(body?.full_name ?? "").trim();
    const phone = String(body?.phone ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();

    if (!full_name || !phone || !email) {
      return NextResponse.json({ error: "Missing profile fields" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // ✅ Get the logged-in user from token
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: "Unauthorized (invalid token)" }, { status: 401 });
    }

    const user_id = userData.user.id;

    // ✅ Upsert profile by user_id (the correct key)
    const { error: upsertErr } = await admin
      .from("profiles")
      .upsert(
        [
          {
            user_id,
            full_name,
            phone,
            email,
          },
        ],
        { onConflict: "user_id" }
      );

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, user_id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}