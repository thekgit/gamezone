// ✅ FILE: app/api/admin/sessions/route.ts
// ✅ COPY-PASTE FULL FILE
// ✅ IMPORTANT: returns ONE UI ROW PER group_id with slots[] inside

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Slot = { start: string | null; end: string | null };

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
        start_time,
        end_time,
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

    const rows = (data || []) as any[];

    // group by group_id (fallback: id)
    const groups = new Map<string, any[]>();
    for (const s of rows) {
      const key = (s.group_id as string | null) || s.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }

    // build ONE UI row per group
    const grouped = Array.from(groups.entries()).map(([groupKey, items]) => {
      // sort by started time (oldest -> newest)
      const sorted = [...items].sort((a, b) => {
        const aT = new Date(a.started_at ?? a.start_time ?? a.created_at ?? 0).getTime();
        const bT = new Date(b.started_at ?? b.start_time ?? b.created_at ?? 0).getTime();
        return aT - bT;
      });

      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      const slots: Slot[] = sorted.map((x) => ({
        start: x.started_at ?? x.start_time ?? null,
        end: x.ends_at ?? x.end_time ?? null,
      }));

      // completed only when QR scanned (ended_at exists for ANY in group)
      const exit_time = sorted.find((x) => !!x.ended_at)?.ended_at ?? null;

      const players =
        typeof last.players === "number"
          ? last.players
          : last.players != null
          ? Number(last.players)
          : null;

      // show latest game name (usually same)
      const game_name = last?.games?.name ?? first?.games?.name ?? null;

      return {
        id: groupKey, // ✅ UI key = group row id
        group_id: (first.group_id as string | null) || groupKey,

        created_at: first.created_at ?? null,
        full_name: first.visitor_name ?? null,
        phone: first.visitor_phone ?? null,
        email: first.visitor_email ?? null,
        game_name,
        players,

        // for compatibility (keep)
        slot_start: slots[0]?.start ?? null,
        slot_end: slots[slots.length - 1]?.end ?? null,

        // ✅ NEW: show many slot ranges in same row
        slots,

        // ✅ COMPLETE only when QR scanned
        exit_time,

        // ✅ keep a representative status (active if any active)
        status: sorted.some((x) => String(x.status).toLowerCase() === "active") ? "active" : "ended",
      };
    });

    // newest group first by created_at
    grouped.sort((a, b) => {
      const aT = new Date(a.created_at ?? 0).getTime();
      const bT = new Date(b.created_at ?? 0).getTime();
      return bT - aT;
    });

    return NextResponse.json({ rows: grouped });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}