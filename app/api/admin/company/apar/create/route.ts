import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normEmail(v: any) {
  return String(v || "").trim().toLowerCase();
}
function normPhone(v: any) {
  const d = String(v || "").replace(/\D/g, "");
  if (!d) return "";
  return d.length >= 10 ? d.slice(-10) : d;
}
function normEmp(v: any) {
  return String(v || "").trim();
}
function normName(v: any) {
  return String(v || "").trim();
}

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    const company_key = "apar";
    const company = "apar";

    const employee_id = normEmp(body.employee_id);
    const email = normEmail(body.email);
    const phone = normPhone(body.phone) || "";
    const full_name = normName(body.full_name) || employee_id || email;

    if (!employee_id || !email) {
      return NextResponse.json({ error: "Employee ID and Email are required." }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // 1) Upsert company_employees
    const { error: empErr } = await admin
      .from("company_employees")
      .upsert(
        { company, company_key, employee_id, full_name, phone: phone || null, email },
        { onConflict: "company_key,email" }
      );

    if (empErr) return NextResponse.json({ error: empErr.message }, { status: 500 });

    // 2) Find if auth exists
    const { data: listRes, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 2000,
    });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

    const existing = (listRes?.users || []).find((u) => (u.email || "").toLowerCase() === email);

    // ✅ If exists -> SET/RESET password to NEW12345 so login always works
    if (existing?.id) {
      const uid = existing.id;

      // ✅ Reset password to NEW12345 (restore old behavior)
      const { error: updAuthErr } = await admin.auth.admin.updateUserById(uid, {
        password: "NEW12345",
        email_confirm: true,
        user_metadata: {
          must_change_password: true,
          company_key,
          company,
          employee_id,
          full_name,
          phone,
        },
      });

      if (updAuthErr) {
        return NextResponse.json({ error: updAuthErr.message }, { status: 500 });
      }

      // Ensure profile row exists + mark password_set true
      const { error: profErr } = await admin.from("profiles").upsert(
        {
          user_id: uid,
          full_name,
          phone,
          email,
          employee_id,
          company,
          must_change_password: true,
          password_set: true,
        },
        { onConflict: "user_id" }
      );

      if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

      return NextResponse.json({
        ok: true,
        created_auth: false,
        user_id: uid,
        message: "User already existed. Password reset to NEW12345.",
      });
    }

    // 3) Create NEW auth user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: "NEW12345",
      email_confirm: true,
      user_metadata: {
        must_change_password: true,
        company_key,
        company,
        employee_id,
        full_name,
        phone,
      },
    });

    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });

    const uid = created?.user?.id;
    if (!uid) return NextResponse.json({ error: "User id missing after create." }, { status: 500 });

    // 4) Create profile for NEW user
    const { error: profErr } = await admin.from("profiles").upsert(
      {
        user_id: uid,
        full_name,
        phone,
        email,
        employee_id,
        company,
        must_change_password: true,
        password_set: true, // ✅ since we just set it to NEW12345
      },
      { onConflict: "user_id" }
    );

    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

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
