// app/api/assistant/visitors/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAssistant } from "@/lib/assertAssistant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const ok = await assertAssistant();
    if (!ok) return NextResponse.json({ error: "Unauthorized", rows: [] }, { status: 401 });

    const admin = supabaseAdmin();
    const nowMs = Date.now();

    // ✅ Fetch recent sessions (then filter safely in JS)
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
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) return NextResponse.json({ error: error.message, rows: [] }, { status: 500 });

    // ✅ Assistant should see ACTIVE only (hard filter)
    const sessionRows = (data || []).filter((s: any) => {
      const st = String(s.status || "").toLowerCase();
      const ended = !!s.ended_at || st === "ended" || st === "completed";
      if (ended) return false;

      // if ends_at exists and already passed, consider not active for assistant
      if (s.ends_at) {
        const ends = new Date(String(s.ends_at)).getTime();
        if (!Number.isNaN(ends) && ends <= nowMs) return false;
      }

      // otherwise active
      return true;
    });

    // ✅ resolve people like admin
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

        full_name: mainPerson.full_name,
        phone: mainPerson.phone,
        email: mainPerson.email,

        people,

        game_name: s?.games?.name ?? null,
        players: s.players ?? null,
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