import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ------------------------
// GET: List users (IMPORTANT: include `id` for frontend)
// ------------------------
export async function GET() {
  try {
    if (!assertAdmin()) {
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

    // ✅ KEY FIX: add `id` so your existing UI (UserRow.id) works
    const users = (data ?? []).map((u: any) => ({
      id: u.user_id,       // frontend expects `id`
      user_id: u.user_id,  // keep original too (harmless)
      full_name: u.full_name ?? "",
      email: u.email ?? "",
      phone: u.phone ?? null,
      employee_id: u.employee_id ?? null,
      company: u.company ?? null,
    }));

    return NextResponse.json({ users }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error", users: [] },
      { status: 500 }
    );
  }
}

// ------------------------
// shared update helper
// ------------------------
async function doUpdate(body: any) {
  if (!assertAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ✅ accept either id or user_id
  const user_id = String(body?.user_id || body?.id || "").trim();
  if (!user_id) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  const payload: {
    full_name?: string;
    phone?: string;
    employee_id?: string;
    company?: string;
  } = {};

  if (body.full_name !== undefined) payload.full_name = String(body.full_name || "").trim();
  if (body.phone !== undefined) payload.phone = String(body.phone || "").trim();
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

// ------------------------
// PATCH: Update (works if UI uses PATCH)
// ------------------------
export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    return await doUpdate(body);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

// ------------------------
// POST: Also allow update (works if UI uses POST)
// ------------------------
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    return await doUpdate(body);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}