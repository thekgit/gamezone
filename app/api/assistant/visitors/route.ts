import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAssistant } from "@/lib/assertAssistant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  employee_id: string | null;
};

type Person = {
  user_id: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  employee_id: string | null;
};

function s(v: any) {
  const t = String(v ?? "").trim();
  return t.length ? t : null;
}

function isGuestLike(v: any) {
  const x = String(v ?? "").trim().toLowerCase();
  return !x || x === "guest" || x === "-" || x === "null";
}

function uniqPeople(list: Person[]) {
  const seen = new Set<string>();
  const out: Person[] = [];
  for (const p of list) {
    const id = String(p.user_id ?? "");
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    out.push(p);
  }
  return out;
}

export async function GET() {
  try {
    if (!(await assertAssistant())) {
      return NextResponse.json({ error: "Unauthorized", rows: [] }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const nowIso = new Date().toISOString();

    // ✅ Must include user_id + player_user_ids
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

    // ✅ collect ids to resolve from profiles
    const ids = new Set<string>();
    for (const row of sessionRows) {
      if (row.user_id) ids.add(String(row.user_id));
      const arr = Array.isArray(row.player_user_ids) ? row.player_user_ids : [];
      for (const pid of arr) if (pid) ids.add(String(pid));
    }

    const idList = Array.from(ids);

    const profilesMap = new Map<string, ProfileRow>();
    if (idList.length > 0) {
      const { data: profs, error: pErr } = await admin
        .from("profiles")
        .select("user_id, full_name, phone, email, employee_id")
        .in("user_id", idList);

      if (pErr) return NextResponse.json({ error: pErr.message, rows: [] }, { status: 500 });

      for (const p of (profs || []) as any[]) {
        const uid = String(p.user_id || "");
        if (!uid) continue;
        profilesMap.set(uid, {
          user_id: uid,
          full_name: p.full_name ?? null,
          phone: p.phone ?? null,
          email: p.email ?? null,
          employee_id: p.employee_id ?? null,
        });
      }
    }

    // ✅ build rows with people[] (same structure as admin)
    const rows = sessionRows.map((s: any) => {
      const mainId = s.user_id ? String(s.user_id) : "";
      const mainProfile = mainId ? profilesMap.get(mainId) : null;

      // main person fallback order:
      // if visitor_name is "Guest", prefer profile name
      const mainFullName = isGuestLike(s.visitor_name)
        ? (mainProfile?.full_name ?? s(s.visitor_name))
        : (s(s.visitor_name) ?? mainProfile?.full_name);

      const mainPerson: Person = {
        user_id: mainId || null,
        full_name: mainFullName ?? null,
        phone: s(s.visitor_phone) ?? mainProfile?.phone ?? null,
        email: s(s.visitor_email) ?? mainProfile?.email ?? null,
        employee_id: mainProfile?.employee_id ?? null,
      };

      const otherIds = Array.isArray(s.player_user_ids) ? s.player_user_ids : [];
      const others: Person[] = otherIds
        .map((pid: any) => {
          const uid = String(pid || "").trim();
          if (!uid) return null;
          const p = profilesMap.get(uid);
          if (!p) return null;
          return {
            user_id: p.user_id,
            full_name: p.full_name ?? null,
            phone: p.phone ?? null,
            email: p.email ?? null,
            employee_id: p.employee_id ?? null,
          } as Person;
        })
        .filter(Boolean) as Person[];

      const people = uniqPeople([mainPerson, ...others]);

      return {
        id: s.id,
        created_at: s.created_at,
        game_name: s?.games?.name ?? null,
        players: s.players ?? null,
        slot_start: s.started_at ?? null,
        slot_end: s.ends_at ?? null,
        status: s.status ?? null,
        exit_time: s.ended_at ?? null,

        // ✅ key part
        people,

        // ✅ backward compat
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