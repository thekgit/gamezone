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
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const rows = Array.isArray(body?.rows) ? (body.rows as Row[]) : [];
    if (!rows.length) return NextResponse.json({ error: "No rows received." }, { status: 400 });

    const admin = supabaseAdmin();
    const company_key = "apar";

    // ✅ load existing auth users once
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

    let imported = 0;
    let existingKept = 0;
    let invalid = 0;
    let createdAuth = 0;

    for (const r of rows) {
      const email = normEmail(r.email);
      const employee_id = normEmp(r.employee_id);
      const full_name = normName(r.full_name);
      const phone = normPhone(r.phone);

      if (!email || !employee_id) {
        invalid++;
        continue;
      }

      // ✅ employee table upsert
      const { error: empErr } = await admin
        .from("company_employees")
        .upsert(
          {
            company_key,
            company: company_key, // ✅ if required NOT NULL
            employee_id,
            full_name: full_name || null,
            phone: phone || null,
            email,
          },
          { onConflict: "company_key,email" }
        );

      if (empErr) {
        invalid++;
        continue;
      }

      imported++;

      // ✅ if auth user exists, keep as-is
      if (existingEmails.has(email)) {
        existingKept++;
        continue;
      }

      // ✅ create auth user with metadata
      const { error: createErr } = await admin.auth.admin.createUser({
        email,
        password: "NEW12345",
        email_confirm: true,
        user_metadata: {
          must_change_password: true,
          company_key,
          employee_id,
          full_name,
          phone,
        },
      });

      if (createErr) {
        invalid++;
        continue;
      }

      createdAuth++;
      existingEmails.add(email);
    }

    return NextResponse.json({
      ok: true,
      imported,
      existing_kept: existingKept,
      invalid,
      created_auth: createdAuth,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}