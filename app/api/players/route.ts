import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function buildOr(q: string) {
  // No over-escaping: we just trim and use ilike
  const s = q.trim();
  return `full_name.ilike.%${s}%,email.ilike.%${s}%,employee_id.ilike.%${s}%`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = String(url.searchParams.get("q") || "").trim();

    const auth = req.headers.get("authorization") || "";
    const jwt = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
    if (!jwt) return NextResponse.json({ error: "Not logged in", users: [] }, { status: 401 });

    if (q.length < 2) return NextResponse.json({ users: [] }, { status: 200 });

    const admin = supabaseAdmin();

    // who am I? (exclude self)
    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ error: "Invalid session", users: [] }, { status: 401 });
    }
    const me = userRes.user.id;

    const users: any[] = [];
    const seen = new Set<string>();

    // 1) profiles search
    const { data: profRows, error: pErr } = await admin
      .from("profiles")
      .select("user_id, full_name, phone, email, employee_id")
      .or(buildOr(q))
      .limit(15);

    if (pErr) return NextResponse.json({ error: pErr.message, users: [] }, { status: 500 });

    for (const r of profRows || []) {
      const uid = String(r.user_id || "");
      if (!uid || uid === me) continue;
      if (seen.has(uid)) continue;
      seen.add(uid);

      users.push({
        user_id: uid,
        full_name: r.full_name ?? null,
        phone: r.phone ?? null,
        email: r.email ?? null,
        employee_id: r.employee_id ?? null,
      });
    }

    // 2) fallback: company_employees -> map by email to profiles
    if (users.length < 15) {
      const { data: empRows, error: eErr } = await admin
        .from("company_employees")
        .select("email, full_name, phone, employee_id")
        .or(buildOr(q))
        .limit(25);

      if (eErr) return NextResponse.json({ error: eErr.message, users: [] }, { status: 500 });

      const emails = Array.from(
        new Set((empRows || []).map((x) => String(x.email || "").toLowerCase()).filter(Boolean))
      );

      if (emails.length) {
        const { data: profByEmail, error: peErr } = await admin
          .from("profiles")
          .select("user_id, full_name, phone, email, employee_id")
          .in("email", emails)
          .limit(25);

        if (peErr) return NextResponse.json({ error: peErr.message, users: [] }, { status: 500 });

        for (const r of profByEmail || []) {
          const uid = String(r.user_id || "");
          if (!uid || uid === me) continue;
          if (seen.has(uid)) continue;
          seen.add(uid);

          users.push({
            user_id: uid,
            full_name: r.full_name ?? null,
            phone: r.phone ?? null,
            email: r.email ?? null,
            employee_id: r.employee_id ?? null,
          });

          if (users.length >= 15) break;
        }
      }
    }

    return NextResponse.json({ users }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error", users: [] }, { status: 500 });
  }
}