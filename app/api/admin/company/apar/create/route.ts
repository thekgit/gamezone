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
    const email = normEmail(body.email);
    const phone = normPhone(body.phone);

    // ✅ full_name NOT NULL everywhere
    const full_name = normName(body.full_name) || employee_id || email;

    if (!employee_id || !email) {
      return NextResponse.json(
        { error: "Employee ID and Email are required." },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();
    const company_key = "apar";
    const company = "apar";

    // ✅ 1) Upsert employee row (always)
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
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

    const existing = (listRes?.users || []).find(
      (u) => (u.email || "").toLowerCase() === email
    );

    // ✅ If already exists, just ensure profiles has required fields (without forcing password reset)
    if (existing?.id) {
      const { error: profErr } = await admin
        .from("profiles")
        .upsert(
          {
            user_id: existing.id,
            email,
            full_name, // ✅ NOT NULL
            phone: phone || null,
            employee_id, // if column exists; if not, remove this line
            // IMPORTANT: do NOT touch must_change_password / password_set for existing users
          },
          { onConflict: "user_id" }
        );

      // If your profiles table does NOT have employee_id column, this can error.
      // If you get an error mentioning employee_id missing, remove employee_id line above.
      if (profErr) {
        return NextResponse.json({ error: profErr.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        created_auth: false,
        message: "User already exists. Kept as-is (password not reset).",
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
      return NextResponse.json({ error: "User id missing after create." }, { status: 500 });
    }

    // ✅ 4) Create/Upsert profiles for NEW user (include NOT NULL full_name!)
    const { error: profErr } = await admin
      .from("profiles")
      .upsert(
        {
          user_id: uid,
          email,
          full_name, // ✅ NOT NULL
          phone: phone || null,
          employee_id, // if column exists; if not, remove this line
          must_change_password: true,
          password_set: false,
        },
        { onConflict: "user_id" }
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
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}