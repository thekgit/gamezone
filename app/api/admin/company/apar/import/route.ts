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

    // ✅ IMPORTANT: prevent timeouts / rate limits on large imports
    // Each request will create max N auth users.
    // If you upload 400 rows, your UI should call this endpoint in chunks (50 rows each).
    const MAX_AUTH_CREATE_PER_REQUEST = 25;

    // ✅ Load existing auth users ONCE (good enough for your scale)
    const { data: listRes, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 2000,
    });

    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 });
    }

    const existingEmails = new Set<string>();
    for (const u of listRes?.users || []) {
      const em = (u.email || "").toLowerCase();
      if (em) existingEmails.add(em);
    }

    // ✅ 1) Clean rows -> bulk upsert employees (FAST)
    const cleanedEmployees: {
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

      const full_name = full_name_raw || employee_id; // DB full_name is NOT NULL

      cleanedEmployees.push({
        company,
        company_key,
        employee_id,
        full_name,
        phone: phone || null,
        email,
      });
    }

    if (!cleanedEmployees.length) {
      return NextResponse.json({ error: "No valid rows to import.", invalid }, { status: 400 });
    }

    // ✅ Bulk upsert employees
    const { error: empErr } = await admin
      .from("company_employees")
      .upsert(cleanedEmployees, { onConflict: "company_key,email" });

    if (empErr) {
      return NextResponse.json({ error: empErr.message }, { status: 500 });
    }

    // ✅ 2) Create auth users ONLY for those that don't exist yet
    //    (limit per request to avoid timeouts)
    let imported = cleanedEmployees.length;
    let existing_kept = 0;
    let created_auth = 0;
    let skipped_auth_due_to_limit = 0;

    // We'll store profiles for NEW users so password check works
    const newProfiles: any[] = [];

    for (const r of cleanedEmployees) {
      const email = r.email;

      if (existingEmails.has(email)) {
        existing_kept++;
        continue;
      }

      if (created_auth >= MAX_AUTH_CREATE_PER_REQUEST) {
        skipped_auth_due_to_limit++;
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
        // keep going; don't fail entire import
        invalid++;
        continue;
      }

      const uid = created?.user?.id;
      if (!uid) {
        invalid++;
        continue;
      }

      // ✅ Profile row used by /api/profile/password-set
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

    // ✅ Bulk upsert profiles for NEW users only (fast)
    if (newProfiles.length > 0) {
      const { error: profErr } = await admin
        .from("profiles")
        .upsert(newProfiles, { onConflict: "id" });

      if (profErr) {
        return NextResponse.json({ error: profErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      company_key,
      imported,
      existing_kept,
      created_auth,
      invalid,
      // ✅ if this is > 0, you must call import again for remaining users
      skipped_auth_due_to_limit,
      hint:
        skipped_auth_due_to_limit > 0
          ? "Auth creation limited per request. Upload in chunks (50 rows) OR call import again until skipped_auth_due_to_limit becomes 0."
          : "Done.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}