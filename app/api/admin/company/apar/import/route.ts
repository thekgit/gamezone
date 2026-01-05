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

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rows = Array.isArray(body?.rows) ? (body.rows as Row[]) : [];
    if (!rows.length) {
      return NextResponse.json({ error: "No rows received." }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const company_key = "apar";
    const company = "apar";

    // ✅ Load existing auth users (we need email existence)
    const { data: listRes, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 2000,
    });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

    const existingEmails = new Set<string>();
    for (const u of listRes?.users || []) {
      const em = (u.email || "").toLowerCase();
      if (em) existingEmails.add(em);
    }

    // ✅ Clean rows
    const cleaned: {
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

      const full_name = full_name_raw || employee_id;

      cleaned.push({
        company,
        company_key,
        employee_id,
        full_name,
        phone: phone || null,
        email,
      });
    }

    if (!cleaned.length) {
      return NextResponse.json({ error: "No valid rows to import.", invalid }, { status: 400 });
    }

    // ✅ Save employees
    // We CANNOT safely bulk upsert on only (company_key,email) because employee_id is also unique.
    // So we do it row-by-row but still fast enough (50 rows per request from UI).
    let employees_saved = 0;
    for (const r of cleaned) {
      const { error: upErr } = await admin
        .from("company_employees")
        .upsert(
          {
            company: r.company,
            company_key: r.company_key,
            employee_id: r.employee_id,
            full_name: r.full_name,
            phone: r.phone,
            email: r.email,
          },
          { onConflict: "company_key,email" }
        );

      if (!upErr) {
        employees_saved++;
        continue;
      }

      // If employee_id unique blocks, fallback: update by employee_id instead
      // (keeps the record correct even if email changed)
      const { error: updErr } = await admin
        .from("company_employees")
        .update({
          full_name: r.full_name,
          phone: r.phone,
          email: r.email,
        })
        .eq("company_key", company_key)
        .eq("employee_id", r.employee_id);

      if (updErr) {
        invalid++;
      } else {
        employees_saved++;
      }
    }

    // ✅ Create auth users for non-existing emails
    let existing_kept = 0;
    let created_auth = 0;
    let auth_failed = 0;

    const newProfiles: any[] = [];

    for (const r of cleaned) {
      const email = r.email;

      if (existingEmails.has(email)) {
        existing_kept++;
        continue;
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
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
        auth_failed++;
        continue;
      }

      const uid = created?.user?.id;
      if (!uid) {
        auth_failed++;
        continue;
      }

      newProfiles.push({
        id: uid,
        email,
        company,
        company_key,
        employee_id: r.employee_id,
        full_name: r.full_name,
        phone: r.phone,
        must_change_password: true,
        password_set: false,
      });

      created_auth++;
      existingEmails.add(email);
    }

    if (newProfiles.length > 0) {
      const { error: profErr } = await admin.from("profiles").upsert(newProfiles, {
        onConflict: "id",
      });
      if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      company_key,
      imported: employees_saved,
      existing_kept,
      created_auth,
      auth_failed,
      invalid,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}