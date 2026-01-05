import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normEmail(v: any) {
  return String(v || "").trim().toLowerCase();
}
function normPhone(v: any) {
  return String(v || "").replace(/\D/g, "").slice(0, 10);
}
function normEmp(v: any) {
  return String(v || "").trim();
}
function normName(v: any) {
  return String(v || "").trim();
}

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const employee_id = normEmp(body.employee_id);
    const full_name_raw = normName(body.full_name);
    const phone = normPhone(body.phone);
    const email = normEmail(body.email);

    if (!employee_id || !email) {
      return NextResponse.json(
        { error: "Employee ID and Email are required." },
        { status: 400 }
      );
    }

    // ✅ full_name is NOT NULL in DB
    const full_name = full_name_raw || employee_id;

    const admin = supabaseAdmin();
    const company_key = "apar";
    const company = "apar";

    // ✅ 1) Upsert employee row (this table stores all details)
    const { error: empErr } = await admin
      .from("company_employees")
      .upsert(
        {
          company,
          company_key,
          employee_id,
          full_name,
          phone: phone || null,
          email,
        },
        { onConflict: "company_key,email" }
      );

    if (empErr) {
      return NextResponse.json({ error: empErr.message }, { status: 500 });
    }

    // ✅ 2) Check if auth user exists (do NOT reset password)
    const { data: listRes, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 2000,
    });
    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 });
    }

    const existing = (listRes?.users || []).find(
      (u) => (u.email || "").toLowerCase() === email
    );

    if (existing?.id) {
      // ✅ Existing user: keep as-is, do NOT touch profiles flags
      return NextResponse.json({
        ok: true,
        created_auth: false,
        message: "User already exists. Kept as-is.",
      });
    }

    // ✅ 3) Create NEW auth user with default password
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: "NEW12345",
      email_confirm: true,
      user_metadata: {
        must_change_password: true,
        company_key,
        employee_id,
        full_name,
        phone: phone || null,
      },
    });

    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 500 });
    }

    const uid = created?.user?.id;
    if (!uid) {
      return NextResponse.json({ error: "User id missing after create" }, { status: 500 });
    }

    // ✅ 4) PROFILES: store ONLY flags (NO company_key etc)
    const { error: profErr } = await admin
      .from("profiles")
      .upsert(
        {
          id: uid,
          must_change_password: true,
          password_set: false,
        },
        { onConflict: "id" }
      );

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      created_auth: true,
      user_id: uid,
      message: "Created NEW user with default password NEW12345.",
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}