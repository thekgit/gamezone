import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST { q: string }
 * Requires Authorization: Bearer <jwt>
 *
 * Returns:
 * { ok: true, results: [{ user_id, full_name, email, phone, employee_id }] }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const q = String(body?.q || "").trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ ok: true, results: [] }, { status: 200 });
    }

    const auth = req.headers.get("authorization") || "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!jwt) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    // ✅ get current user from jwt (service role can do this)
    const { data: userRes, error: uErr } = await admin.auth.getUser(jwt);
    if (uErr || !userRes?.user?.id) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const me = userRes.user;
    const myUserId = me.id;

    // try to determine company (from metadata OR profiles)
    let company = String(me.user_metadata?.company || me.user_metadata?.company_key || "").trim();

    if (!company) {
      const { data: p } = await admin
        .from("profiles")
        .select("company")
        .eq("user_id", myUserId)
        .maybeSingle();
      if (p?.company) company = String(p.company);
    }

    const like = `%${q}%`;

    // ✅ 1) Search profiles (best source)
    // NOTE: your schema uses profiles.user_id (NOT profiles.id)
    let profilesRows: any[] = [];
    {
      const query = admin
        .from("profiles")
        .select("user_id, full_name, email, phone, employee_id, company")
        .neq("user_id", myUserId)
        .or(`full_name.ilike.${like},email.ilike.${like},employee_id.ilike.${like}`)
        .limit(15);

      if (company) query.eq("company", company);

      const { data, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      profilesRows = data || [];
    }

    // ✅ 2) If profiles has results, return them
    if (profilesRows.length > 0) {
      return NextResponse.json(
        {
          ok: true,
          results: profilesRows.map((r) => ({
            user_id: r.user_id,
            full_name: r.full_name ?? null,
            email: r.email ?? null,
            phone: r.phone ?? null,
            employee_id: r.employee_id ?? null,
          })),
        },
        { status: 200 }
      );
    }

    // ✅ 3) Fallback: search company_employees by company_key + query
    // Then map email -> auth user_id (if auth exists)
    let employees: any[] = [];
    {
      const query = admin
        .from("company_employees")
        .select("company_key, company, employee_id, full_name, phone, email")
        .or(`full_name.ilike.${like},email.ilike.${like},employee_id.ilike.${like}`)
        .limit(15);

      if (company) {
        // some projects store it in company, some in company_key
        query.or(`company.eq.${company},company_key.eq.${company}`);
      }

      const { data, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      employees = data || [];
    }

    if (!employees.length) {
      return NextResponse.json({ ok: true, results: [] }, { status: 200 });
    }

    // Build email list
    const emails = Array.from(
      new Set(employees.map((e) => String(e.email || "").toLowerCase()).filter(Boolean))
    );

    // Find auth users by listing (supabase admin API doesn’t support direct email search reliably)
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

    const results = employees
      .map((e) => {
        const em = String(e.email || "").toLowerCase();
        const uid = emailToUid.get(em);
        if (!uid) return null; // if no auth user, can’t add as player_user_id
        if (uid === myUserId) return null; // exclude self
        return {
          user_id: uid,
          full_name: e.full_name ?? null,
          email: e.email ?? null,
          phone: e.phone ?? null,
          employee_id: e.employee_id ?? null,
        };
      })
      .filter(Boolean)
      .slice(0, 15);

    return NextResponse.json({ ok: true, results }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}