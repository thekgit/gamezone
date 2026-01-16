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

    // ✅ Logic:
    // ended_at is null
    // AND (status is active OR status is null)
    // AND (ends_at is null OR ends_at > now)
    //
    // We express (status...) AND (ends_at...) using OR of AND-groups:
    // (status=active AND ends_at is null)
    // OR (status=active AND ends_at > now)
    // OR (status is null AND ends_at is null)
    // OR (status is null AND ends_at > now)

    const OR = [
      `and(status.eq.active,ends_at.is.null)`,
      `and(status.eq.active,ends_at.gt.${nowIso})`,
      `and(status.is.null,ends_at.is.null)`,
      `and(status.is.null,ends_at.gt.${nowIso})`,
    ].join(",");

    const { data, error } = await admin
      .from("sessions")
      .select(
        `
        id,
        created_at,
        status,
        players,
        started_at,
        ends_at,
        ended_at,
        games:game_id ( name )
      `
      )
      .is("ended_at", null)
      .or(OR)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) return NextResponse.json({ error: error.message, rows: [] }, { status: 500 });

    const rows = (data || []).map((s: any) => ({
      id: s.id,
      created_at: s.created_at,
      game_name: s?.games?.name ?? null,
      players: s.players ?? null,
      slot_start: s.started_at ?? null,
      slot_end: s.ends_at ?? null,
      status: s.status ?? null,
      exit_time: s.ended_at ?? null,
    }));

    return NextResponse.json({ rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error", rows: [] }, { status: 500 });
  }
}