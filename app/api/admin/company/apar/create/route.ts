import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

    const company_key = "apar";
    const company = "apar";

    const employee_id = normEmp(body.employee_id);
    const email = normEmail(body.email);
    const phone = normPhone(body.phone);
    const full_name = normName(body.full_name) || employee_id || email;

    if (!employee_id || !email) {
      return NextResponse.json({ error: "Employee ID and Email are required." }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json(
        { error: "Phone is required (10 digits) because profiles.phone is NOT NULL." },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    // 1) Upsert employee master data
    const { error: empErr } = await admin
      .from("company_employees")
      .upsert(
        { company, company_key, employee_id, full_name, phone, email },
        { onConflict: "company_key,email" }
      );

    if (empErr) return NextResponse.json({ error: empErr.message }, { status: 500 });

    // 2) Check if Auth user exists by listing (cheap enough for your size)
    const { data: listRes, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 2000,
    });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

    const existing = (listRes?.users || []).find((u) => (u.email || "").toLowerCase() === email);

    // Helper: upsert profile row using YOUR schema (PK is user_id)
    async function upsertProfile(user_id: string, must_change_password: boolean, password_set: boolean) {
      const { error } = await admin.from("profiles").upsert(
        {
          user_id,
          full_name,
          phone,
          email,
          employee_id,
          company,
          must_change_password,
          password_set,
        },
        { onConflict: "user_id" }
      );
      return error;
    }

    // 3A) If Auth exists -> decide if we should repair password
    if (existing?.id) {
      // read profile to know if password already set
      const { data: prof, error: profReadErr } = await admin
        .from("profiles")
        .select("user_id, password_set")
        .eq("user_id", existing.id)
        .maybeSingle();

      if (profReadErr) return NextResponse.json({ error: profReadErr.message }, { status: 500 });

      const password_set = prof?.password_set;

      // If no profile row exists, create one but DO NOT reset password (unknown user history)
      if (!prof?.user_id) {
        const e = await upsertProfile(existing.id, false, true);
        if (e) return NextResponse.json({ error: e.message }, { status: 500 });

        return NextResponse.json({
          ok: true,
          created_auth: false,
          repaired_password: false,
          message: "Auth existed. Profile created. Password not touched.",
        });
      }

      // ✅ If password_set=false -> user never set password -> safe to force NEW12345 again
      if (password_set === false) {
        const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
          password: "NEW12345",
          user_metadata: {
            must_change_password: true,
            company_key,
            employee_id,
            full_name,
            phone,
          },
        });
        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

        const e = await upsertProfile(existing.id, true, false);
        if (e) return NextResponse.json({ error: e.message }, { status: 500 });

        return NextResponse.json({
          ok: true,
          created_auth: false,
          repaired_password: true,
          message: "Auth existed but password was not set. Repaired to NEW12345.",
        });
      }

      // ✅ password_set=true -> never touch
      return NextResponse.json({
        ok: true,
        created_auth: false,
        repaired_password: false,
        message: "User already active. Kept as-is (password not reset).",
      });
    }

    // 3B) Auth missing -> create new user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
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

    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });

    const uid = created?.user?.id;
    if (!uid) return NextResponse.json({ error: "User id missing after create." }, { status: 500 });

    const e = await upsertProfile(uid, true, false);
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      created_auth: true,
      repaired_password: false,
      user_id: uid,
      message: "Created NEW user with default password NEW12345.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}