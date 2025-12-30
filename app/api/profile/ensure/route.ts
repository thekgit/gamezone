import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // get user from token
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const user = userData.user;
    const body = await req.json().catch(() => ({}));
    const full_name = String(body?.full_name ?? "").trim();
    const phone = String(body?.phone ?? "").trim();

    // Upsert profile
    const { error: upsertErr } = await supabaseAdmin
      .from("profiles")
      .upsert(
        [
          {
            user_id: user.id,
            full_name: full_name || "Unknown",
            phone: phone || "Unknown",
          },
        ],
        { onConflict: "user_id" }
      );

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}