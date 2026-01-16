import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) return NextResponse.json({}, { status: 401 });
    const { user_id } = await req.json();
    const admin = supabaseAdmin();

    await admin.auth.admin.updateUserById(user_id, {
      password: "NEW12345",
      user_metadata: { must_change_password: true },
    });

    await admin
      .from("profiles")
      .update({ must_change_password: true, password_set: false })
      .eq("user_id", user_id);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Reset failed" },
      { status: 500 }
    );
  }
}