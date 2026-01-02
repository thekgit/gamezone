import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
        games:game_id ( name )
      `
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // ✅ group by group_id (fallback to id if null)
    const map = new Map<string, any>();

    for (const s of data || []) {
      const gid = (s as any).group_id || (s as any).id;

      if (!map.has(gid)) {
        map.set(gid, {
          group_id: gid,
          created_at: (s as any).created_at,
          full_name: (s as any).visitor_name ?? null,
          phone: (s as any).visitor_phone ?? null,
          email: (s as any).visitor_email ?? null,
          players: (s as any).players ?? null,
          segments: [],
          hasActive: false,
          latestEndedAt: null as string | null,
        });
      }

      const g = map.get(gid);

      g.segments.push({
        session_id: (s as any).id,
        game_name: (s as any)?.games?.name ?? null,
        slot_start: (s as any).started_at ?? null,
        slot_end: (s as any).ends_at ?? null,
        ended_at: (s as any).ended_at ?? null,
        status: (s as any).status ?? null,
      });

      if (((s as any).status || "").toLowerCase() === "active" && !(s as any).ended_at) {
        g.hasActive = true;
      }

      const endedAt = (s as any).ended_at ?? null;
      if (endedAt) {
        if (!g.latestEndedAt || new Date(endedAt) > new Date(g.latestEndedAt)) {
          g.latestEndedAt = endedAt;
        }
      }
    }

    // sort segments by start time asc
    const rows = Array.from(map.values()).map((r) => {
      r.segments.sort((a: any, b: any) => {
        const ta = a.slot_start ? new Date(a.slot_start).getTime() : 0;
        const tb = b.slot_start ? new Date(b.slot_start).getTime() : 0;
        return ta - tb;
      });

      // show game label
      const firstGame = r.segments?.[0]?.game_name || null;
      const extra = Math.max(0, r.segments.length - 1);
      const game_name = extra > 0 ? `${firstGame} (+${extra})` : firstGame;

      return {
        group_id: r.group_id,
        created_at: r.created_at,
        full_name: r.full_name,
        phone: r.phone,
        email: r.email,
        game_name,
        players: r.players,
        segments: r.segments,
        exit_time: r.latestEndedAt,          // real scan time
        status: r.hasActive ? "active" : "ended",
      };
    });

    // newest first by created_at
    rows.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}