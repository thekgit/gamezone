import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ------------------------
// GET: List users
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

    return NextResponse.json({ users: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error", users: [] },
      { status: 500 }
    );
  }
}

// ------------------------
// UPDATE helper
// ------------------------
async function updateUser(body: any) {
  if (!assertAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ✅ support both keys (your DB uses user_id, some UI sends id)
  const user_id = String(body?.user_id || body?.id || "").trim();
  if (!user_id) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  // ✅ only update allowed fields
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
// PATCH: Update user
// ------------------------
export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    return await updateUser(body);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

// ------------------------
// POST: Also allow update (so it works even if UI uses POST)
// Supports:
// - { action: "update", ...fields }
// - or direct body without action
// ------------------------
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // If your UI sends POST for update, this catches it.
    if (String(body?.action || "").toLowerCase() === "update" || body?.full_name !== undefined || body?.phone !== undefined || body?.employee_id !== undefined || body?.company !== undefined) {
      return await updateUser(body);
    }

    return NextResponse.json({ error: "Unsupported POST" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}