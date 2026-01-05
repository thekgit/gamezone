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

    // ✅ Reads the logged-in user from JWT
    const { data, error } = await admin.auth.getUser(jwt);
    if (error) return NextResponse.json({ error: error.message }, { status: 401 });

    const user = data?.user;
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });

    // ✅ We rely on metadata flag (set when admin creates/imports users)
    const must_change_password = user.user_metadata?.must_change_password === true;

    return NextResponse.json({
      ok: true,
      user_id: user.id,
      email: user.email ?? null,
      must_change_password,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}