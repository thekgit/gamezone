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
  const d = String(v || "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "";
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
    const company = "apar";

    // ✅ keep it to avoid timeouts; your UI already chunks 50
    const MAX_AUTH_ACTIONS_PER_REQUEST = 25;

    // 1) Clean rows
    const cleaned: {
      employee_id: string;
      full_name: string;
      phone: string;
      email: string;
    }[] = [];

    let invalid = 0;
    let invalid_missing_phone = 0;

    for (const r of rows) {
      const email = normEmail(r.email);
      const employee_id = normEmp(r.employee_id);
      const phone = normPhone(r.phone);
      const full_name = normName(r.full_name) || employee_id || email;

      if (!email || !employee_id) {
        invalid++;
        continue;
      }
      if (!phone) {
        invalid++;
        invalid_missing_phone++;
        continue;
      }

      cleaned.push({ employee_id, full_name, phone, email });
    }

    if (!cleaned.length) {
      return NextResponse.json(
        {
          error: "No valid rows to import.",
          invalid,
          invalid_missing_phone,
          note: "Phone is mandatory because profiles.phone is NOT NULL.",
        },
        { status: 400 }
      );
    }

    // 2) Bulk upsert employees
    const empPayload = cleaned.map((r) => ({
      company,
      company_key,
      employee_id: r.employee_id,
      full_name: r.full_name,
      phone: r.phone,
      email: r.email,
    }));

    const { error: empErr } = await admin
      .from("company_employees")
      .upsert(empPayload, { onConflict: "company_key,email" });

    if (empErr) return NextResponse.json({ error: empErr.message }, { status: 500 });

    // 3) Load existing auth users once
    const { data: listRes, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 2000,
    });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

    const emailToAuthId = new Map<string, string>();
    for (const u of listRes?.users || []) {
      const em = (u.email || "").toLowerCase();
      if (em && u.id) emailToAuthId.set(em, u.id);
    }

    // 4) Read profiles for these auth ids (to know password_set)
    const authIds = Array.from(emailToAuthId.values());
    let passwordSetByUserId = new Map<string, boolean>();

    if (authIds.length > 0) {
      const { data: profRows } = await admin
        .from("profiles")
        .select("user_id, password_set")
        .in("user_id", authIds);

      for (const p of profRows || []) {
        passwordSetByUserId.set(String(p.user_id), Boolean(p.password_set));
      }
    }

    // helper
    async function upsertProfile(user_id: string, r: any, must_change_password: boolean, password_set: boolean) {
      const { error } = await admin.from("profiles").upsert(
        {
          user_id,
          full_name: r.full_name,
          phone: r.phone,
          email: r.email,
          employee_id: r.employee_id,
          company,
          must_change_password,
          password_set,
        },
        { onConflict: "user_id" }
      );
      return error;
    }

    // 5) Create/repair auth users (limited per request)
    let imported = cleaned.length;
    let existing_kept = 0;
    let created_auth = 0;
    let repaired_password = 0;
    let skipped_due_to_limit = 0;

    for (const r of cleaned) {
      if (created_auth + repaired_password >= MAX_AUTH_ACTIONS_PER_REQUEST) {
        skipped_due_to_limit++;
        continue;
      }

      const existingId = emailToAuthId.get(r.email);

      if (!existingId) {
        // create auth
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: r.email,
          password: "NEW12345",
          email_confirm: true,
          user_metadata: {
            must_change_password: true,
            company_key,
            employee_id: r.employee_id,
            full_name: r.full_name,
            phone: r.phone,
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

        const e = await upsertProfile(uid, r, true, false);
        if (e) return NextResponse.json({ error: e.message }, { status: 500 });

        emailToAuthId.set(r.email, uid);
        passwordSetByUserId.set(uid, false);
        created_auth++;
        continue;
      }

      // auth exists
      const ps = passwordSetByUserId.get(existingId);

      // If profile missing -> create profile but do not touch password
      if (ps === undefined) {
        const e = await upsertProfile(existingId, r, false, true);
        if (e) return NextResponse.json({ error: e.message }, { status: 500 });

        existing_kept++;
        continue;
      }

      // If password not set -> safe repair to NEW12345
      if (ps === false) {
        const { error: updErr } = await admin.auth.admin.updateUserById(existingId, {
          password: "NEW12345",
          user_metadata: {
            must_change_password: true,
            company_key,
            employee_id: r.employee_id,
            full_name: r.full_name,
            phone: r.phone,
          },
        });

        if (updErr) {
          invalid++;
          continue;
        }

        const e = await upsertProfile(existingId, r, true, false);
        if (e) return NextResponse.json({ error: e.message }, { status: 500 });

        repaired_password++;
        continue;
      }

      // password_set=true -> keep as is
      existing_kept++;
    }

    return NextResponse.json({
      ok: true,
      imported,
      existing_kept,
      created_auth,
      repaired_password,
      invalid,
      invalid_missing_phone,
      skipped_due_to_limit,
      hint:
        skipped_due_to_limit > 0
          ? "Limited auth actions per request. Your UI must continue calling import in chunks until skipped_due_to_limit becomes 0."
          : "Done.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}