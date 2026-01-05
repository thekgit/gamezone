import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Row = {
  employee_id: string;
  full_name?: string;
  phone?: string;
  email: string;
};

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

function isAlreadyExistsAuthError(e: any) {
  const msg = String(e?.message || e?.error_description || e || "").toLowerCase();
  return (
    msg.includes("already registered") ||
    msg.includes("already exists") ||
    msg.includes("user already") ||
    msg.includes("duplicate") ||
    msg.includes("email address already")
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const rows = Array.isArray(body?.rows) ? (body.rows as Row[]) : [];
    if (!rows.length) return NextResponse.json({ error: "No rows received." }, { status: 400 });

    const admin = supabaseAdmin();
    const company_key = "apar";
    const company = "apar";

    // ✅ Clean rows for employee upsert
    const employees: {
      company: string;
      company_key: string;
      employee_id: string;
      full_name: string;
      phone: string | null;
      email: string;
    }[] = [];

    let invalid = 0;

    for (const r of rows) {
      const email = normEmail(r.email);
      const employee_id = normEmp(r.employee_id);
      const full_name_raw = normName(r.full_name);
      const phone = normPhone(r.phone);

      if (!email || !employee_id) {
        invalid++;
        continue;
      }

      employees.push({
        company,
        company_key,
        employee_id,
        full_name: full_name_raw || employee_id, // full_name is NOT NULL
        phone: phone || null,
        email,
      });
    }

    if (!employees.length) {
      return NextResponse.json({ error: "No valid rows to import.", invalid }, { status: 400 });
    }

    // ✅ 1) Bulk upsert company_employees (fast)
    const { error: empErr } = await admin
      .from("company_employees")
      .upsert(employees, { onConflict: "company_key,email" });

    if (empErr) return NextResponse.json({ error: empErr.message }, { status: 500 });

    // ✅ 2) Create auth users row-by-row (no listUsers)
    // Existing users will throw "already registered" → we count as existing_kept
    let existing_kept = 0;
    let created_auth = 0;
    let auth_failed = 0;

    const newProfiles: any[] = [];

    for (const r of employees) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: r.email,
        password: "NEW12345",
        email_confirm: true,
        user_metadata: {
          must_change_password: true,
          company,
          company_key,
          employee_id: r.employee_id,
          full_name: r.full_name,
          phone: r.phone,
        },
      });

      if (createErr) {
        if (isAlreadyExistsAuthError(createErr)) {
          existing_kept++;
        } else {
          auth_failed++;
        }
      } else if (created?.user?.id) {
        created_auth++;

        // profiles row (only for NEW users)
        newProfiles.push({
          id: created.user.id,
          email: r.email,
          company,
          company_key,
          employee_id: r.employee_id,
          full_name: r.full_name,
          phone: r.phone,
          must_change_password: true,
          password_set: false,
        });
      }

      // ✅ avoid rate limits
      await sleep(120);
    }

    // ✅ 3) Bulk upsert profiles for NEW users only
    if (newProfiles.length) {
      const { error: profErr } = await admin.from("profiles").upsert(newProfiles, { onConflict: "id" });
      if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      company_key,
      imported: employees.length,
      created_auth,
      existing_kept,
      invalid,
      auth_failed,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}