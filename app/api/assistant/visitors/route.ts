import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAssistant } from "@/lib/assertAssistant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Person = {
  user_id: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  employee_id: string | null;
};

function cleanEmail(v: any) {
  const s = String(v || "").trim().toLowerCase();
  return s || null;
}

function isGuestLike(v: any) {
  const s = String(v || "").trim().toLowerCase();
  return !s || s === "guest" || s === "-" || s === "null";
}

export async function GET() {
  try {
    if (!(await assertAssistant())) {
      return NextResponse.json({ error: "Unauthorized", rows: [] }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const nowIso = new Date().toISOString();

    // ✅ MUST SELECT user_id + player_user_ids otherwise you can NEVER resolve people
    const { data, error } = await admin
      .from("sessions")
      .select(
        `
        id,
        user_id,
        player_user_ids,
        created_at,
        status,
        players,
        started_at,
        ends_at,
        ended_at,
        visitor_name,
        visitor_phone,
        visitor_email,
        games:game_id ( name )
      `
      )
      .is("ended_at", null)
      .or("status.eq.active,status.is.null")
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) return NextResponse.json({ error: error.message, rows: [] }, { status: 500 });

    const sessionRows = (data || []) as any[];

    // ---------- Collect IDs + Emails needed ----------
    const idsToFetch = new Set<string>();
    const emailsToFetch = new Set<string>();

    for (const s of sessionRows) {
      if (s.user_id) idsToFetch.add(String(s.user_id));

      const arr = Array.isArray(s.player_user_ids) ? s.player_user_ids : [];
      for (const pid of arr) if (pid) idsToFetch.add(String(pid));

      const ve = cleanEmail(s.visitor_email);
      if (ve) emailsToFetch.add(ve);
    }

    const idList = Array.from(idsToFetch);
    const emailList = Array.from(emailsToFetch);

    // ---------- Fetch profiles by user_id ----------
    const profilesMap = new Map<string, any>();
    if (idList.length > 0) {
      const { data: profs, error: pErr } = await admin
        .from("profiles")
        .select("user_id, full_name, phone, email, employee_id")
        .in("user_id", idList);

      if (pErr) return NextResponse.json({ error: pErr.message, rows: [] }, { status: 500 });

      for (const p of profs || []) profilesMap.set(String(p.user_id), p);
    }

    // ---------- Fallback: fetch company_employees by visitor_email ----------
    // (in case some user has session stored but profile missing/incomplete)
    const empByEmail = new Map<string, any>();
    if (emailList.length > 0) {
      const { data: emps, error: eErr } = await admin
        .from("company_employees")
        .select("email, full_name, phone, employee_id")
        .in("email", emailList);

      if (eErr) return NextResponse.json({ error: eErr.message, rows: [] }, { status: 500 });

      for (const e of emps || []) {
        const em = cleanEmail(e.email);
        if (em) empByEmail.set(em, e);
      }
    }

    // ---------- Build rows ----------
    const rows = sessionRows.map((s: any) => {
      const mainId = s.user_id ? String(s.user_id) : null;
      const mainProfile = mainId ? profilesMap.get(mainId) : null;

      const ve = cleanEmail(s.visitor_email);
      const emp = ve ? empByEmail.get(ve) : null;

      // ✅ If visitor_name is Guest-like, override with real profile/employee name
      const mainFullName =
        isGuestLike(s.visitor_name)
          ? (mainProfile?.full_name ?? emp?.full_name ?? null)
          : (s.visitor_name ?? mainProfile?.full_name ?? emp?.full_name ?? null);

      const mainPhone =
        (s.visitor_phone ?? null) ||
        (mainProfile?.phone ?? null) ||
        (emp?.phone ?? null) ||
        null;

      const mainEmail =
        (s.visitor_email ?? null) ||
        (mainProfile?.email ?? null) ||
        (ve ?? null);

      const mainEmployeeId =
        (mainProfile?.employee_id ?? null) ||
        (emp?.employee_id ?? null) ||
        null;

      const mainPerson: Person = {
        user_id: mainId,
        full_name: mainFullName,
        phone: mainPhone,
        email: mainEmail,
        employee_id: mainEmployeeId,
      };

      const otherIds = Array.isArray(s.player_user_ids) ? s.player_user_ids : [];
      const others: Person[] = otherIds
        .map((pid: any) => profilesMap.get(String(pid)))
        .filter(Boolean)
        .map((p: any) => ({
          user_id: String(p.user_id),
          full_name: p.full_name ?? null,
          phone: p.phone ?? null,
          email: p.email ?? null,
          employee_id: p.employee_id ?? null,
        }));

      const people = [mainPerson, ...others];

      return {
        id: s.id,
        created_at: s.created_at,
        game_name: s?.games?.name ?? null,
        players: s.players ?? null,
        slot_start: s.started_at ?? null,
        slot_end: s.ends_at ?? null,
        status: s.status ?? null,
        exit_time: s.ended_at ?? null,

        // ✅ New field UI should use
        people,

        // ✅ Backward compat (if UI still reads these)
        full_name: people[0]?.full_name ?? null,
        phone: people[0]?.phone ?? null,
        email: people[0]?.email ?? null,
      };
    });

    return NextResponse.json({ rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error", rows: [] }, { status: 500 });
  }
}