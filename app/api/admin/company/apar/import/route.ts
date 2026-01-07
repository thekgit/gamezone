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
  // keep digits only, max 10
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
    const company = "apar";

    // ✅ 1) Load existing auth users ONCE
    const { data: listRes, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 2000,
    });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

    // email -> userId map
    const emailToUid = new Map<string, string>();
    for (const u of listRes?.users || []) {
      const em = (u.email || "").toLowerCase();
      if (em && u.id) emailToUid.set(em, u.id);
    }

    // ✅ 2) Clean rows
    const cleanedEmployees: {
      company: string;
      company_key: string;
      employee_id: string;
      full_name: string;
      phone: string; // NOT NULL safe for profiles too
      email: string;
    }[] = [];

    let invalid = 0;

    for (const r of rows) {
      const email = normEmail(r.email);
      const employee_id = normEmp(r.employee_id);
      const full_name_raw = normName(r.full_name);
      const phone_raw = normPhone(r.phone);

      if (!email || !employee_id) {
        invalid++;
        continue;
      }

      const full_name = full_name_raw || employee_id;
      const phone = phone_raw || ""; // ✅ safe for profiles NOT NULL

      cleanedEmployees.push({
        company,
        company_key,
        employee_id,
        full_name,
        phone,
        email,
      });
    }

    if (!cleanedEmployees.length) {
      return NextResponse.json({ error: "No valid rows to import.", invalid }, { status: 400 });
    }

    // ✅ 3) Bulk upsert company_employees (fast)
    const { error: empErr } = await admin
      .from("company_employees")
      .upsert(
        cleanedEmployees.map((r) => ({
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

    // ✅ 4) Create missing auth users (limited per request)
    const MAX_AUTH_CREATE_PER_REQUEST = 25;

    let imported = cleanedEmployees.length;
    let existing_kept = 0;
    let created_auth = 0;
    let auth_failed = 0;

    // ✅ NEW: repair existing auth users that haven't set password yet
    let repaired_auth = 0;
    let repaired_skipped_password_set = 0;

    // Profiles we will upsert (user_id is PK)
    const profilesUpserts: any[] = [];

    // We'll only query profiles for the users we care about (existing auth users)
    const existingUids: string[] = [];
    for (const r of cleanedEmployees) {
      const uid = emailToUid.get(r.email);
      if (uid) existingUids.push(uid);
    }

    // Fetch existing profiles in one go (if none, returns empty)
    // NOTE: profiles PK is user_id (based on your constraints)
    let profilesByUid = new Map<string, any>();
    if (existingUids.length > 0) {
      const { data: profRows, error: profReadErr } = await admin
        .from("profiles")
        .select("user_id, password_set, must_change_password")
        .in("user_id", Array.from(new Set(existingUids)));

      if (!profReadErr && Array.isArray(profRows)) {
        for (const p of profRows) profilesByUid.set(String(p.user_id), p);
      }
    }

    for (const r of cleanedEmployees) {
      const email = r.email;
      const existingUid = emailToUid.get(email);

      // -------------------------
      // A) Auth DOES NOT exist => create new auth user
      // -------------------------
      if (!existingUid) {
        if (created_auth >= MAX_AUTH_CREATE_PER_REQUEST) {
          // don't fail whole import, just stop creating new auth
          continue;
        }

        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
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

        emailToUid.set(email, uid);
        created_auth++;

        // ✅ create profile row for password logic
        profilesUpserts.push({
          user_id: uid,
          email,
          full_name: r.full_name,
          phone: r.phone || "",
          employee_id: r.employee_id,
          company,
          must_change_password: true,
          password_set: false,
        });

        continue;
      }

      // -------------------------
      // B) Auth EXISTS => do NOT reset by default
      // But REPAIR if password_set is false OR profile missing
      // -------------------------
      existing_kept++;

      const prof = profilesByUid.get(existingUid);

      const passwordSet = prof?.password_set === true; // strict
      const mustChange = prof?.must_change_password === true;

      // If profile missing OR indicates not set yet => repair
      if (!passwordSet) {
        // ✅ Force password NEW12345 + must_change_password true
        const { error: updErr } = await admin.auth.admin.updateUserById(existingUid, {
          password: "NEW12345",
          user_metadata: {
            must_change_password: true,
            company_key,
            company,
            employee_id: r.employee_id,
            full_name: r.full_name,
            phone: r.phone,
          },
        });

        if (updErr) {
          auth_failed++;
          continue;
        }

        // ✅ Ensure profile exists + flags are correct
        profilesUpserts.push({
          user_id: existingUid,
          email,
          full_name: r.full_name,
          phone: r.phone || "",
          employee_id: r.employee_id,
          company,
          must_change_password: true,
          password_set: false,
        });

        repaired_auth++;
      } else {
        // User already set password => keep as-is
        repaired_skipped_password_set++;
        // Optional: keep profile info updated but DO NOT touch flags
        profilesUpserts.push({
          user_id: existingUid,
          email,
          full_name: r.full_name,
          phone: r.phone || "",
          employee_id: r.employee_id,
          company,
          // do NOT include must_change_password/password_set here
        });
      }
    }

    // ✅ 5) Bulk upsert profiles
    // profiles PK is user_id
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
      repaired_auth,
      repaired_skipped_password_set,
      invalid,
      auth_failed,
      hint:
        created_auth >= MAX_AUTH_CREATE_PER_REQUEST
          ? "Auth creation has per-request limit (25). Upload again if you still have missing users."
          : "Done.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}