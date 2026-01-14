import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Escape for ilike
function escLike(q: string) {
  return q.replace(/[%_]/g, "\\$&");
}

async function doSearch(req: Request, qRaw: string) {
  const q = String(qRaw || "").trim();

  if (!q || q.length < 2) {
    // Return BOTH keys for compatibility with different UIs
    return NextResponse.json({ ok: true, users: [], results: [] }, { status: 200 });
  }

  const auth = req.headers.get("authorization") || "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!jwt) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const admin = supabaseAdmin();

  // ✅ current user from jwt
  const { data: userRes, error: uErr } = await admin.auth.getUser(jwt);
  if (uErr || !userRes?.user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const me = userRes.user;
  const myUserId = me.id;

  // Company detection (optional)
  let company = String(me.user_metadata?.company || me.user_metadata?.company_key || "").trim();
  if (!company) {
    const { data: p } = await admin
      .from("profiles")
      .select("company")
      .eq("user_id", myUserId)
      .maybeSingle();
    if (p?.company) company = String(p.company);
  }

  const safe = escLike(q);
  const like = `%${safe}%`;

  // ✅ 1) Search profiles (best source)
  let query1 = admin
    .from("profiles")
    .select("user_id, full_name, email, phone, employee_id, company")
    .neq("user_id", myUserId)
    .or(`full_name.ilike.${like},email.ilike.${like},employee_id.ilike.${like}`)
    .limit(15);

  if (company) query1 = query1.eq("company", company);

  const { data: profRows, error: pErr } = await query1;
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const usersFromProfiles =
    (profRows || []).map((r: any) => ({
      user_id: r.user_id,
      full_name: r.full_name ?? null,
      email: r.email ?? null,
      phone: r.phone ?? null,
      employee_id: r.employee_id ?? null,
    })) ?? [];

  if (usersFromProfiles.length > 0) {
    return NextResponse.json(
      { ok: true, users: usersFromProfiles, results: usersFromProfiles },
      { status: 200 }
    );
  }

  // ✅ 2) Fallback: company_employees search (then map email -> auth user id)
  let query2 = admin
    .from("company_employees")
    .select("company_key, company, employee_id, full_name, phone, email")
    .or(`full_name.ilike.${like},email.ilike.${like},employee_id.ilike.${like}`)
    .limit(25);

  if (company) {
    // keep both because some projects store in company vs company_key
    query2 = query2.or(`company.eq.${company},company_key.eq.${company}`);
  }

  const { data: employees, error: eErr } = await query2;
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });

  if (!employees?.length) {
    return NextResponse.json({ ok: true, users: [], results: [] }, { status: 200 });
  }

  // Need auth ids for those emails
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

  const results =
    (employees || [])
      .map((e: any) => {
        const em = String(e.email || "").toLowerCase();
        const uid = emailToUid.get(em);
        if (!uid) return null;
        if (uid === myUserId) return null;
        return {
          user_id: uid,
          full_name: e.full_name ?? null,
          email: e.email ?? null,
          phone: e.phone ?? null,
          employee_id: e.employee_id ?? null,
        };
      })
      .filter(Boolean)
      .slice(0, 15) ?? [];

  return NextResponse.json({ ok: true, users: results, results }, { status: 200 });
}

// ✅ UI style: GET /api/players?q=...
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = String(url.searchParams.get("q") || "");
  return doSearch(req, q);
}

// ✅ Old style: POST /api/players { q }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return doSearch(req, body?.q || "");
}