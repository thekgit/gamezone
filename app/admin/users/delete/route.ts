import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export async function POST(req: Request) {
  if (!assertAdmin()) return NextResponse.json({}, { status: 401 });

  const { user_id, email } = await req.json();
  const admin = supabaseAdmin();

  // 1️⃣ Delete auth user FIRST (cascade removes profiles)
  await admin.auth.admin.deleteUser(user_id);

  // 2️⃣ Delete company_employees record
  await admin.from("company_employees").delete().eq("email", email);

  return NextResponse.json({ ok: true });
}
