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

export async function GET() {
  try {
    if (!(await assertAssistant())) {
      return NextResponse.json({ error: "Unauthorized", rows: [] }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const nowIso = new Date().toISOString();

    // ✅ include user_id + player_user_ids + visitor fields so we can build people[]
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

    if (error) {
      return NextResponse.json({ error: error.message, rows: [] }, { status: 500 });
    }

    const sessionRows = (data || []) as any[];

    // ✅ collect all ids we need (owner + added players)
    const idsToFetch = new Set<string>();
    for (const s of sessionRows) {
      if (s.user_id) idsToFetch.add(String(s.user_id));
      const arr = Array.isArray(s.player_user_ids) ? s.player_user_ids : [];
      for (const pid of arr) if (pid) idsToFetch.add(String(pid));
    }

    const idList = Array.from(idsToFetch);

    // ✅ pull profiles for all involved users
    const profilesMap = new Map<string, any>();
    if (idList.length > 0) {
      const { data: profs, error: pErr } = await admin
        .from("profiles")
        .select("user_id, full_name, phone, email, employee_id")
        .in("user_id", idList);

      if (pErr) {
        return NextResponse.json({ error: pErr.message, rows: [] }, { status: 500 });
      }

      for (const p of profs || []) {
        profilesMap.set(String(p.user_id), p);
      }
    }

    const rows = sessionRows.map((s: any) => {
      const mainId = s.user_id ? String(s.user_id) : "";
      const mainProfile = mainId ? profilesMap.get(mainId) : null;

      // ✅ main person: prefer stored visitor_* (works even if profile is missing)
      const mainPerson: Person = {
        user_id: mainId || null,
        full_name: s.visitor_name ?? mainProfile?.full_name ?? null,
        phone: s.visitor_phone ?? mainProfile?.phone ?? null,
        email: s.visitor_email ?? mainProfile?.email ?? null,
        employee_id: mainProfile?.employee_id ?? null,
      };

      // ✅ other players: use profiles
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
        people, // ✅ this fixes "Guest"
      };
    });

    return NextResponse.json({ rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error", rows: [] }, { status: 500 });
  }
}