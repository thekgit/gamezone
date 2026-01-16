import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    if (!(await assertAdmin())) {
      return NextResponse.json({ error: "Unauthorized", users: [] }, { status: 401 });
    }

    const admin = supabaseAdmin();

    const { data, error } = await admin
      .from("profiles")
      .select("user_id, full_name, email, phone, employee_id, company")
      .order("full_name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message, users: [] }, { status: 500 });
    }

    return NextResponse.json({ users: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error", users: [] },
      { status: 500 }
    );
  }
}