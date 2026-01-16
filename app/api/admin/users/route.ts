import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ---------- GET (LIST) ----------
export async function GET() {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized", users: [] }, { status: 401 });
    }

    const admin = supabaseAdmin();

    // ✅ NOTE: We'll add delete-filter once we confirm how delete works (deleted_at / is_deleted etc.)
    const { data, error } = await admin
      .from("profiles")
      .select("user_id, full_name, email, phone, employee_id, company")
      .order("full_name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message, users: [] }, { status: 500 });
    }

    const users = (data ?? []).map((u: any) => ({
      id: u.user_id,
      user_id: u.user_id,
      full_name: u.full_name ?? "",
      email: u.email ?? "",
      phone: u.phone ?? "",
      employee_id: u.employee_id ?? "",
      company: u.company ?? "",
    }));

    return NextResponse.json({ users }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error", users: [] },
      { status: 500 }
    );
  }
}

// ---------- UPDATE helper ----------
async function updateUser(body: any) {
  if (!assertAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user_id = String(body?.user_id || body?.id || "").trim();
  if (!user_id) {
    return NextResponse.json({ error: "Missing user id (id/user_id)" }, { status: 400 });
  }

  const payload: Record<string, any> = {};

  // sanitize + validate name
  if (body.full_name !== undefined) {
    const name = String(body.full_name || "").trim();
    if (name.length < 3) {
      return NextResponse.json(
        { error: "Name must be at least 3 characters." },
        { status: 400 }
      );
    }
    payload.full_name = name;
  }

  // sanitize + validate phone (digits only, exactly 10)
  if (body.phone !== undefined) {
    const phoneDigits = String(body.phone || "").replace(/\D/g, "");
    if (phoneDigits.length !== 10) {
      return NextResponse.json(
        { error: "Phone must be exactly 10 digits." },
        { status: 400 }
      );
    }
    payload.phone = phoneDigits;
  }

  if (body.employee_id !== undefined) payload.employee_id = String(body.employee_id || "").trim();
  if (body.company !== undefined) payload.company = String(body.company || "").trim();

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { error } = await admin
    .from("profiles")
    .update(payload)
    .eq("user_id", user_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

// ---------- PATCH (UPDATE) ----------
export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    return await updateUser(body);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

// ---------- POST (UPDATE fallback) ----------
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    return await updateUser(body);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}