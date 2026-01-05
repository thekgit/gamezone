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

    // ✅ Load existing auth users once
    const { data: listRes, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 2000,
    });

    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 });
    }

    const existingEmails = new Set<string>();
    const emailToUserId = new Map<string, string>();

    for (const u of listRes?.users || []) {
      const em = (u.email || "").toLowerCase();
      if (em) {
        existingEmails.add(em);
        if (u.id) emailToUserId.set(em, u.id);
      }
    }

    let imported = 0;
    let existing_kept = 0;
    let invalid = 0;
    let created_auth = 0;

    for (const r of rows) {
      const email = normEmail(r.email);
      const employee_id = normEmp(r.employee_id);
      const full_name_raw = normName(r.full_name);
      const phone = normPhone(r.phone);

      if (!email || !employee_id) {
        invalid++;
        continue;
      }

      const full_name = full_name_raw || employee_id; // ✅ full_name NOT NULL

      // ✅ 1) Upsert employee row
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
        invalid++;
        continue;
      }

      imported++;

      // ✅ 2) If auth already exists → keep as-is, do NOT reset password
      if (existingEmails.has(email)) {
        existing_kept++;

        const uid = emailToUserId.get(email);
        if (uid) {
          // Optional: fill missing profile fields without touching must_change_password
          await admin
            .from("profiles")
            .upsert(
              {
                id: uid,
                email,
                company,
                company_key,
                employee_id,
                full_name,
                phone: phone || null,
              },
              { onConflict: "id" }
            );
        }

        continue;
      }

      // ✅ 3) Create NEW auth user
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: "NEW12345",
        email_confirm: true,
        user_metadata: {
          must_change_password: true,
          company,
          company_key,
          employee_id,
          full_name,
          phone: phone || null,
        },
      });

      if (createErr) {
        invalid++;
        continue;
      }

      const uid = created?.user?.id;
      if (!uid) {
        invalid++;
        continue;
      }

      // ✅ 4) Force set-password for NEW users via profiles
      const { error: profErr } = await admin
        .from("profiles")
        .upsert(
          {
            id: uid,
            email,
            company,
            company_key,
            employee_id,
            full_name,
            phone: phone || null,
            must_change_password: true,
            password_set: false,
          },
          { onConflict: "id" }
        );

      if (profErr) {
        invalid++;
        continue;
      }

      created_auth++;
      existingEmails.add(email);
      emailToUserId.set(email, uid);
    }

    return NextResponse.json({
      ok: true,
      imported,
      existing_kept,
      invalid,
      created_auth,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}