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

function uniqPeople(list: Person[]) {
  const seen = new Set<string>();
  const out: Person[] = [];
  for (const p of list) {
    const k = String(p.user_id || "");
    if (k && seen.has(k)) continue;
    if (k) seen.add(k);
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

    // ✅ IMPORTANT: include user_id + player_user_ids + visitor_* so we can build people[]
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
      // active only
      .is("ended_at", null)
      .or("status.eq.active,status.is.null")
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) return NextResponse.json({ error: error.message, rows: [] }, { status: 500 });

    const sessionRows = (data || []) as any[];

    // ---- Collect all IDs needed (main + added players)
    const idsToFetch = new Set<string>();
    for (const s of sessionRows) {
      if (s.user_id) idsToFetch.add(String(s.user_id));
      const arr = Array.isArray(s.player_user_ids) ? s.player_user_ids : [];
      for (const pid of arr) if (pid) idsToFetch.add(String(pid));
    }
    const idList = Array.from(idsToFetch);

    // ---- 1) Fetch profiles for these IDs
    const profilesMap = new Map<string, any>();
    if (idList.length > 0) {
      const { data: profRows, error: pErr } = await admin
        .from("profiles")
        .select("user_id, full_name, phone, email, employee_id")
        .in("user_id", idList);

      if (pErr) return NextResponse.json({ error: pErr.message, rows: [] }, { status: 500 });

      for (const p of profRows || []) {
        profilesMap.set(String(p.user_id), p);
      }
    }

    // ---- 2) For missing profiles, fallback from Auth (so employee_id + 2nd person never disappears)
    const missingIds = idList.filter((id) => !profilesMap.has(id));
    const authMap = new Map<string, any>();

    if (missingIds.length > 0) {
      // getUserById exists in supabase admin client
      const authResults = await Promise.all(
        missingIds.slice(0, 50).map(async (uid) => {
          try {
            const { data, error } = await admin.auth.admin.getUserById(uid);
            if (error || !data?.user) return null;
            return data.user;
          } catch {
            return null;
          }
        })
      );

      for (const u of authResults.filter(Boolean) as any[]) {
        authMap.set(String(u.id), u);
      }
    }

    // ---- Build rows with people[]
    const rows = sessionRows.map((s: any) => {
      const mainId = s.user_id ? String(s.user_id) : "";

      const mainProfile = mainId ? profilesMap.get(mainId) : null;
      const mainAuth = mainId ? authMap.get(mainId) : null;

      const mainPerson: Person = {
        user_id: mainId || null,
        full_name:
          s.visitor_name ??
          mainProfile?.full_name ??
          mainAuth?.user_metadata?.full_name ??
          null,
        phone:
          s.visitor_phone ??
          mainProfile?.phone ??
          mainAuth?.user_metadata?.phone ??
          null,
        email:
          s.visitor_email ??
          mainProfile?.email ??
          mainAuth?.email ??
          null,
        employee_id:
          mainProfile?.employee_id ??
          mainAuth?.user_metadata?.employee_id ??
          null,
      };

      const otherIds = Array.isArray(s.player_user_ids) ? s.player_user_ids : [];
      const others: Person[] = otherIds.map((pid: any) => {
        const id = String(pid || "");
        const p = profilesMap.get(id);
        const u = authMap.get(id);

        return {
          user_id: id || null,
          full_name: p?.full_name ?? u?.user_metadata?.full_name ?? null,
          phone: p?.phone ?? u?.user_metadata?.phone ?? null,
          email: p?.email ?? u?.email ?? null,
          employee_id: p?.employee_id ?? u?.user_metadata?.employee_id ?? null,
        };
      });

      const people = uniqPeople([mainPerson, ...others]);

      return {
        id: s.id,
        created_at: s.created_at,
        game_name: s?.games?.name ?? null,

        // ✅ make sure players count matches people count
        players: people.length,

        slot_start: s.started_at ?? null,
        slot_end: s.ends_at ?? null,
        status: s.status ?? null,
        exit_time: s.ended_at ?? null,

        // ✅ assistant UI will use this (same as admin)
        people,
        full_name: mainPerson.full_name,
        phone: mainPerson.phone,
        email: mainPerson.email,
      };
    });

    return NextResponse.json({ rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error", rows: [] }, { status: 500 });
  }
}