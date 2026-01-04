import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ImportRow = {
  employee_id: string;
  full_name: string;
  phone: string;
  email: string;
};

type ImportBody = {
  rows: ImportRow[];
};

function cleanEmail(v: unknown) {
  return String(v || "").trim().toLowerCase();
}

function cleanPhone(v: unknown) {
  return String(v || "").replace(/\D/g, "").slice(0, 10);
}

function cleanText(v: unknown) {
  return String(v || "").trim();
}

async function findAuthUserIdByEmail(admin: ReturnType<typeof supabaseAdmin>, email: string) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  const found = data.users.find((u) => (u.email || "").toLowerCase() === email);
  return found?.id || null;
}

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Partial<ImportBody>;
    const inputRows = Array.isArray(body.rows) ? body.rows : [];

    if (inputRows.length === 0) {
      return NextResponse.json({ error: "rows[] is required" }, { status: 400 });
    }

    const company_key = "apar";
    const admin = supabaseAdmin();

    let insertedEmployees = 0;
    let existedEmployees = 0;
    let createdAuth = 0;
    let existedAuth = 0;
    const errors: { email?: string; employee_id?: string; error: string }[] = [];

    for (const r of inputRows) {
      const employee_id = cleanText(r.employee_id);
      const full_name = cleanText(r.full_name);
      const phone = cleanPhone(r.phone);
      const email = cleanEmail(r.email);

      if (!employee_id || !full_name || !/^\d{10}$/.test(phone) || !email.includes("@")) {
        errors.push({ employee_id, email, error: "Invalid row (employee_id/full_name/phone/email)" });
        continue;
      }

      // 1) Upsert employee record
      const { data: emp, error: empErr } = await admin
        .from("company_employees")
        .upsert(
          { company_key, employee_id, full_name, phone, email },
          { onConflict: "company_key,email" }
        )
        .select("email")
        .single();

      if (empErr) {
        errors.push({ employee_id, email, error: empErr.message });
        continue;
      }

      // we can’t easily know insert vs update here reliably -> count as processed
      // (optional: you can fetch before upsert if you want exact)
      insertedEmployees += emp ? 1 : 0;

      // 2) Ensure auth user exists
      const existingUserId = await findAuthUserIdByEmail(admin, email);

      if (!existingUserId) {
        const { error: createErr } = await admin.auth.admin.createUser({
          email,
          password: "NEW12345",
          email_confirm: true,
          user_metadata: {
            company_key,
            employee_id,
            full_name,
            phone,
            temp_password: true,
          },
        });

        if (createErr) {
          errors.push({ employee_id, email, error: createErr.message });
          continue;
        }

        createdAuth += 1;
      } else {
        existedAuth += 1; // already had account -> do NOT reset password
      }
    }

    return NextResponse.json({
      ok: true,
      insertedEmployees,
      existedEmployees, // not used currently, kept for future
      createdAuth,
      existedAuth,
      errors,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}