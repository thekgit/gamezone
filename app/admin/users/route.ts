import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";
export async function GET() {
  const { data } = await supabaseAdmin()
    .from("profiles")
    .select("user_id, full_name, employee_id, email, phone, company");

  return NextResponse.json({ users: data });
}