import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAssistant } from "@/lib/assertAssistant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    if (!(await assertAssistant())) {
      return NextResponse.json({ error: "Unauthorized", rows: [] }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const nowIso = new Date().toISOString();

    // ✅ MUST include user_id + player_user_ids
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

    // ✅ Collect ids for profiles lookup
    const idsToFetch = new Set<string>();
    for (const s of sessionRows) {
      if (s.user_id) idsToFetch.add(String(s.user_id));
      const arr = Array.isArray(s.player_user_ids) ? s.player_user_ids : [];
      for (const pid of arr) if (pid) idsToFetch.add(String(pid));
    }

    const idList = Array.from(idsToFetch);

    const profilesMap = new Map<string, any>();
    if (idList.length > 0) {
      const { data: profRows, error: pErr } = await admin
        .from("profiles")
        .select("user_id, full_name, phone, email, employee_id")
        .in("user_id", idList);

      if (pErr) return NextResponse.json({ error: pErr.message, rows: [] }, { status: 500 });

      for (const p of profRows || []) profilesMap.set(String(p.user_id), p);
    }

    const rows = sessionRows.map((s: any) => {
      const mainId = s.user_id ? String(s.user_id) : "";
      const mainProfile = mainId ? profilesMap.get(mainId) : null;

      // ✅ main person fallback order: visitor_* -> profile
      const mainPerson = {
        user_id: mainId || null,
        full_name: s.visitor_name ?? mainProfile?.full_name ?? null,
        phone: s.visitor_phone ?? mainProfile?.phone ?? null,
        email: s.visitor_email ?? mainProfile?.email ?? null,
        employee_id: mainProfile?.employee_id ?? null,
      };

      const otherIds = Array.isArray(s.player_user_ids) ? s.player_user_ids : [];
      const others = otherIds
        .map((pid: any) => profilesMap.get(String(pid)))
        .filter(Boolean)
        .map((p: any) => ({
          user_id: String(p.user_id),
          full_name: p.full_name ?? null,
          phone: p.phone ?? null,
          email: p.email ?? null,
          employee_id: p.employee_id ?? null,
        }));

      // ✅ de-duplicate (if someone added themselves)
      const seen = new Set<string>();
      const people = [mainPerson, ...others].filter((p: any) => {
        const id = String(p.user_id || "");
        if (!id) return true;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      return {
        id: s.id,
        created_at: s.created_at,

        // legacy fields
        full_name: mainPerson.full_name,
        phone: mainPerson.phone,
        email: mainPerson.email,

        // ✅ IMPORTANT for UI
        people,

        game_name: s?.games?.name ?? null,
        players: s.players ?? (people?.length ?? null),
        slot_start: s.started_at ?? null,
        slot_end: s.ends_at ?? null,
        status: s.status ?? null,
        exit_time: s.ended_at ?? null,
      };
    });

    return NextResponse.json({ rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error", rows: [] }, { status: 500 });
  }
}