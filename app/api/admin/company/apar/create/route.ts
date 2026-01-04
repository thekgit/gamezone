import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CreateBody = {
  employee_id: string;
  full_name: string;
  phone: string;
  email: string;
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
  // ✅ supabase-js v2: listUsers has NO email filter. Fetch and filter locally.
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

    const body = (await req.json().catch(() => ({}))) as Partial<CreateBody>;

    const company_key = "apar";

    const employee_id = cleanText(body.employee_id);
    const full_name = cleanText(body.full_name);
    const phone = cleanPhone(body.phone);
    const email = cleanEmail(body.email);

    if (!employee_id) return NextResponse.json({ error: "employee_id is required" }, { status: 400 });
    if (!full_name) return NextResponse.json({ error: "full_name is required" }, { status: 400 });
    if (!/^\d{10}$/.test(phone)) return NextResponse.json({ error: "phone must be 10 digits" }, { status: 400 });
    if (!email || !email.includes("@")) return NextResponse.json({ error: "valid email is required" }, { status: 400 });

    const admin = supabaseAdmin();

    // 1) Upsert into your company employees table (create this table if not exists)
    const { error: upErr } = await admin
    .from("company_employees")
    .upsert(
      {
        company_key: "apar",
        employee_id,
        full_name,
        phone,
        email,
      },
      {
        onConflict: "company_key,email",
      }
    );
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    // 2) Ensure Supabase Auth user exists (default password NEW12345 only if new user)
    const existingUserId = await findAuthUserIdByEmail(admin, email);

    if (!existingUserId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: "NEW12345",
        email_confirm: true,
        user_metadata: {
          company_key,
          employee_id,
          full_name,
          phone,
          temp_password: true, // your login flow can force password change if this is true
        },
      });

      if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });

      return NextResponse.json({
        ok: true,
        created_new_auth_user: true,
        user_id: created.user?.id || null,
      });
    }

    // user already existed -> don’t touch their password
    return NextResponse.json({
      ok: true,
      created_new_auth_user: false,
      user_id: existingUserId,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}