import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DbSession = any;

export async function GET() {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = supabaseAdmin();

    const { data, error } = await admin
      .from("sessions")
      .select(
        `
        id,
        group_id,
        created_at,
        status,
        players,
        started_at,
        ends_at,
        ended_at,
        visitor_name,
        visitor_phone,
        visitor_email,
        exit_token,
        games:game_id ( name )
      `
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rowsRaw: DbSession[] = data || [];

    // group by group_id (fallback = id for very old records)
    const groups = new Map<string, DbSession[]>();
    for (const s of rowsRaw) {
      const gid = s.group_id || s.id;
      if (!groups.has(gid)) groups.set(gid, []);
      groups.get(gid)!.push(s);
    }

    // build ONE row per group (latest session decides "active"/"completed")
    const rows = Array.from(groups.entries()).map(([gid, list]) => {
      // sort by started_at/created_at
      list.sort((a, b) => {
        const ta = new Date(a.started_at || a.created_at || 0).getTime();
        const tb = new Date(b.started_at || b.created_at || 0).getTime();
        return ta - tb;
      });

      const first = list[0];
      const last = list[list.length - 1];

      // completed ONLY when QR scanned (ended_at exists on any)
      const ended_at = list.find((x) => x.ended_at)?.ended_at ?? null;

      const slots = list.map((x) => ({
        session_id: x.id,
        start: x.started_at ?? null,
        end: x.ends_at ?? null,
        status: x.status ?? null,
      }));

      return {
        id: last.id, // row key (latest session id)
        group_id: first.group_id || gid,
        created_at: first.created_at ?? null,

        full_name: first.visitor_name ?? null,
        phone: first.visitor_phone ?? null,
        email: first.visitor_email ?? null,
        game_name: first?.games?.name ?? null,

        players: typeof first.players === "number" ? first.players : first.players != null ? Number(first.players) : null,

        // show overall slot range from first start to last end
        slot_start: first.started_at ?? null,
        slot_end: last.ends_at ?? null,

        // QR scan time
        exit_time: ended_at,

        // consider active if no QR scan yet
        status: ended_at ? "ended" : "active",

        // IMPORTANT: UI needs these
        slots,
      };
    });

    // sort: active first, then newest
    rows.sort((a: any, b: any) => {
      const aActive = !a.exit_time;
      const bActive = !b.exit_time;
      if (aActive !== bActive) return aActive ? -1 : 1;
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return tb - ta;
    });

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}