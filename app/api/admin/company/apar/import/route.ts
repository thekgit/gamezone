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
  // digits only, last 10 if longer
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

    // 1) Load auth users ONCE (email -> uid)
    const { data: listRes, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 2000,
    });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

    const emailToUid = new Map<string, string>();
    for (const u of listRes?.users || []) {
      const em = (u.email || "").toLowerCase();
      if (em && u.id) emailToUid.set(em, u.id);
    }

    // 2) Clean rows
    const cleaned: {
      company: string;
      company_key: string;
      employee_id: string;
      full_name: string;
      phone: string; // profiles.phone NOT NULL -> use ""
      email: string;
    }[] = [];

    let invalid = 0;

    for (const r of rows) {
      const email = normEmail(r.email);
      const employee_id = normEmp(r.employee_id);
      const full_name = normName(r.full_name) || employee_id || email;
      const phone = normPhone(r.phone) || "";

      if (!email || !employee_id) {
        invalid++;
        continue;
      }

      cleaned.push({ company, company_key, employee_id, full_name, phone, email });
    }

    if (!cleaned.length) {
      return NextResponse.json({ error: "No valid rows to import.", invalid }, { status: 400 });
    }

    // 3) Bulk upsert company_employees (fast)
    const { error: empErr } = await admin
      .from("company_employees")
      .upsert(
        cleaned.map((r) => ({
          company: r.company,
          company_key: r.company_key,
          employee_id: r.employee_id,
          full_name: r.full_name,
          phone: r.phone || null,
          email: r.email,
        })),
        { onConflict: "company_key,email" }
      );

    if (empErr) return NextResponse.json({ error: empErr.message }, { status: 500 });

    // 4) Read existing profiles for users we already have (optional; we don't rely on it now)
    const existingUids = Array.from(
      new Set(cleaned.map((r) => emailToUid.get(r.email)).filter(Boolean) as string[])
    );

    if (existingUids.length > 0) {
      const { error: profReadErr } = await admin
        .from("profiles")
        .select("user_id")
        .in("user_id", existingUids);

      if (profReadErr) return NextResponse.json({ error: profReadErr.message }, { status: 500 });
    }

    // 5) Create NEW auth users (limited) + prepare profile upserts
    const MAX_AUTH_CREATE_PER_REQUEST = 25;

    const imported = cleaned.length;
    let existing_kept = 0;
    let created_auth = 0;
    let auth_failed = 0;

    const profilesUpserts: any[] = [];

    for (const r of cleaned) {
      const existingUid = emailToUid.get(r.email);

      // A) Auth missing -> create NEW user
      if (!existingUid) {
        if (created_auth >= MAX_AUTH_CREATE_PER_REQUEST) {
          // skip auth create (admin will click import again)
          continue;
        }

        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: r.email,
          password: "NEW12345",
          email_confirm: true,
          user_metadata: {
            must_change_password: true,
            company_key,
            company,
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

        emailToUid.set(r.email, uid);
        created_auth++;

        profilesUpserts.push({
          user_id: uid,
          full_name: r.full_name,
          phone: r.phone || "",
          email: r.email,
          employee_id: r.employee_id,
          company,
          must_change_password: true,
          password_set: true, // ✅ password is NEW12345
        });

        continue;
      }

      // B) Auth exists -> RESET password to NEW12345 (restore old behavior)
      existing_kept++;

      const { error: updAuthErr } = await admin.auth.admin.updateUserById(existingUid, {
        password: "NEW12345",
        email_confirm: true,
        user_metadata: {
          must_change_password: true,
          company_key,
          company,
          employee_id: r.employee_id,
          full_name: r.full_name,
          phone: r.phone,
        },
      });

      if (updAuthErr) {
        auth_failed++;
        continue;
      }

      profilesUpserts.push({
        user_id: existingUid,
        full_name: r.full_name,
        phone: r.phone || "",
        email: r.email,
        employee_id: r.employee_id,
        company,
        must_change_password: true,
        password_set: true,
      });
    }

    // 6) Upsert profiles ONCE (after loop)
    if (profilesUpserts.length > 0) {
      const { error: profErr } = await admin.from("profiles").upsert(profilesUpserts, {
        onConflict: "user_id",
      });
      if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      imported,
      existing_kept,
      created_auth,
      invalid,
      auth_failed,
      hint:
        created_auth >= MAX_AUTH_CREATE_PER_REQUEST
          ? "Auth creation limited to 25 per request. Click Import again to create remaining auth users."
          : "Done.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}