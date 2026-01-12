import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const user_id = String(body?.user_id || "").trim();
    const email = String(body?.email || "").trim();

    if (!user_id) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // 1) Delete profile row (so it NEVER appears again in list)
    const { error: профErr } = await admin.from("profiles").delete().eq("user_id", user_id);
    if (профErr) {
      return NextResponse.json({ error: профErr.message }, { status: 500 });
    }

    // 2) Delete company_employees record (optional but keep)
    if (email) {
      const { error: ceErr } = await admin.from("company_employees").delete().eq("email", email);
      if (ceErr) {
        return NextResponse.json({ error: ceErr.message }, { status: 500 });
      }
    }

    // 3) Delete auth user (clean up auth)
    const { error: authErr } = await admin.auth.admin.deleteUser(user_id);
    if (authErr) {
      // Profile already deleted; still report auth delete failure
      return NextResponse.json({ error: authErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}