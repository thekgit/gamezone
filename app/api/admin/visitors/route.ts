import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function uniqStrings(arr: any[]) {
  return Array.from(new Set(arr.filter(Boolean).map((x) => String(x).trim()).filter(Boolean)));
}

export async function GET() {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized", rows: [] }, { status: 401 });
    }

    const admin = supabaseAdmin();

    // ✅ Fetch sessions + game name + player_user_ids
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
        visitor_name,
        visitor_phone,
        visitor_email,
        player_user_ids,
        games:game_id ( name )
      `
      )
      .order("created_at", { ascending: false })
      .limit(9999);

    if (error) {
      return NextResponse.json({ error: error.message, rows: [] }, { status: 500 });
    }

    const sessions = data || [];

    // ✅ Collect all additional player user_ids from all sessions
    const allExtraUids = uniqStrings(
      sessions.flatMap((s: any) => Array.isArray(s.player_user_ids) ? s.player_user_ids : [])
    );

    // ✅ Load profiles for those extra users (no relationship join)
    const profilesMap = new Map<string, { full_name: string | null; phone: string | null; email: string | null }>();

    if (allExtraUids.length > 0) {
      const { data: profs, error: pErr } = await admin
        .from("profiles")
        .select("user_id, full_name, phone, email")
        .in("user_id", allExtraUids);

      if (pErr) {
        return NextResponse.json({ error: pErr.message, rows: [] }, { status: 500 });
      }

      for (const p of profs || []) {
        profilesMap.set(String(p.user_id), {
          full_name: (p as any).full_name ?? null,
          phone: (p as any).phone ?? null,
          email: (p as any).email ?? null,
        });
      }
    }

    // ✅ Build rows exactly how your UI expects
    const rows =
      sessions.map((s: any) => {
        const extraIds: string[] = Array.isArray(s.player_user_ids) ? s.player_user_ids : [];

        const primaryName = s.visitor_name ?? null;
        const primaryPhone = s.visitor_phone ?? null;
        const primaryEmail = s.visitor_email ?? null;

        const extraNames: string[] = [];
        const extraPhones: string[] = [];
        const extraEmails: string[] = [];

        for (const uid of extraIds) {
          const p = profilesMap.get(String(uid));
          if (!p) continue;

          if (p.full_name) extraNames.push(p.full_name);
          if (p.phone) extraPhones.push(p.phone);
          if (p.email) extraEmails.push(p.email);
        }

        // ✅ Combine as ONE cell text (same row)
        const full_name = uniqStrings([primaryName, ...extraNames]).join(", ") || null;
        const phone = uniqStrings([primaryPhone, ...extraPhones]).join(", ") || null;
        const email = uniqStrings([primaryEmail, ...extraEmails]).join(", ") || null;

        return {
          id: s.id,
          created_at: s.created_at ?? null,

          full_name,
          phone,
          email,

          game_name: s?.games?.name ?? null,
          players: s.players ?? null,

          slot_start: s.started_at ?? null,
          slot_end: s.ends_at ?? null,

          exit_time: s.ended_at ?? null,
          status: s.status ?? null,
        };
      }) ?? [];

    return NextResponse.json({ rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error", rows: [] }, { status: 500 });
  }
}