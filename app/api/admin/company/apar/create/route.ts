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
    const full_name = normName(body.full_name);
    const phone = normPhone(body.phone);
    const email = normEmail(body.email);

    if (!employee_id || !email) {
      return NextResponse.json(
        { error: "Employee ID and Email are required." },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();
    const company_key = "apar";

    // ✅ 1) Upsert into company_employees (send BOTH company + company_key)
    const { error: empErr } = await admin
      .from("company_employees")
      .upsert(
        {
          company_key,
          company: company_key, // ✅ fixes NOT NULL constraint
          employee_id,
          full_name: full_name || null,
          phone: phone || null,
          email,
        },
        { onConflict: "company_key,email" } // ✅ matches your UNIQUE
      );

    if (empErr) {
      return NextResponse.json({ error: empErr.message }, { status: 500 });
    }

    // ✅ 2) If Auth user already exists → DO NOT change password
    const { data: listRes, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

    const existing = (listRes?.users || []).find(
      (u) => (u.email || "").toLowerCase() === email
    );

    if (existing?.id) {
      // optional: ensure profile row exists, but do not force password change
      await admin.from("profiles").upsert(
        {
          id: existing.id,
          email,
          company: company_key,
          employee_id,
          full_name: full_name || null,
          phone: phone || null,
          // DO NOT set must_change_password for existing users
        },
        { onConflict: "id" }
      );

      return NextResponse.json({
        ok: true,
        created_auth: false,
        message: "User already exists. Kept as-is.",
      });
    }

    // ✅ 3) Create Auth user with default password
    const { data: createdUser, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password: "NEW12345",
        email_confirm: true,
      });

    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 500 });
    }

    const uid = createdUser?.user?.id;
    if (!uid) {
      return NextResponse.json({ error: "User id missing after create" }, { status: 500 });
    }

    // ✅ 4) Create profile and force password change only for NEW users
    const { error: profErr } = await admin.from("profiles").upsert(
      {
        id: uid,
        email,
        company: company_key,
        employee_id,
        full_name: full_name || null,
        phone: phone || null,
        must_change_password: true,
      },
      { onConflict: "id" }
    );

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      created_auth: true,
      message: "Created user with default password NEW12345.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}