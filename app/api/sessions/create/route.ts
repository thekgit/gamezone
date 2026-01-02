import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Slot = {
  session_id: string;
  game_name: string | null;
  slot_start: string | null;
  slot_end: string | null;
  status: string | null;
};

type GroupRow = {
  id: string; // group_id
  group_id: string;
  created_at: string | null;

  full_name: string | null;
  phone: string | null;
  email: string | null;

  players: number | null;

  // show latest game name in main column (optional)
  game_name: string | null;

  // one exit time for the whole group (QR scan time)
  exit_time: string | null;

  // active if latest session is active and not exited
  status: string | null;

  // all slots inside this group
  slots: Slot[];
};

function pickMaxIso(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

export async function GET() {
  try {
    if (!assertAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const groups = new Map<string, GroupRow>();

    for (const s of (data || []) as any[]) {
      const gid = (s.group_id || s.id) as string; // fallback for old rows
      const slot_start = s.started_at ?? s.start_time ?? null;
      const slot_end = s.ends_at ?? s.end_time ?? null;
      const game_name = s?.games?.name ?? null;

      const slot: Slot = {
        session_id: s.id,
        game_name,
        slot_start,
        slot_end,
        status: s.status ?? null,
      };

      const existing = groups.get(gid);

      if (!existing) {
        groups.set(gid, {
          id: gid,
          group_id: gid,
          created_at: s.created_at ?? null,

          full_name: s.visitor_name ?? null,
          phone: s.visitor_phone ?? null,
          email: s.visitor_email ?? null,

          players: typeof s.players === "number" ? s.players : s.players != null ? Number(s.players) : null,

          game_name, // latest shown initially
          exit_time: s.ended_at ?? null,
          status: s.status ?? null,

          slots: [slot],
        });
      } else {
        // keep earliest created_at as group timestamp
        if (existing.created_at && s.created_at) {
          if (new Date(s.created_at).getTime() < new Date(existing.created_at).getTime()) {
            existing.created_at = s.created_at;
          }
        } else if (!existing.created_at) {
          existing.created_at = s.created_at ?? null;
        }

        // take max ended_at as group exit_time (QR scan time)
        existing.exit_time = pickMaxIso(existing.exit_time, s.ended_at ?? null);

        // keep players (if later row has value and earlier doesn't)
        if (existing.players == null && s.players != null) {
          existing.players = typeof s.players === "number" ? s.players : Number(s.players);
        }

        // push slot
        existing.slots.push(slot);

        // decide latest status + game_name based on newest created_at
        // (since we iterating newest-first, first slot is newest; but we can still compute)
        // easiest: set latest from the slot we see first (newest). So:
        // if existing.status is null, set it; else keep.
        // But to be safe, update when s.created_at is newer than current latest:
        // We'll store latest by checking max time using a local compare:
        const curLatest = existing.slots[0]; // because we add, we want newest first
        // We'll just keep newest slot at index 0 by unshifting:
        // Move logic: instead of push above, do unshift:
      }
    }

    // Fix: we want slots in chronological order (oldest → newest) for display
    const rows: GroupRow[] = Array.from(groups.values()).map((g) => {
      g.slots.sort((a, b) => {
        const ta = a.slot_start ? new Date(a.slot_start).getTime() : 0;
        const tb = b.slot_start ? new Date(b.slot_start).getTime() : 0;
        return ta - tb;
      });

      // latest slot determines "game_name" and "status"
      const last = g.slots[g.slots.length - 1];
      g.game_name = last?.game_name ?? g.game_name ?? null;
      g.status = last?.status ?? g.status ?? null;

      return g;
    });

    // sort groups by created_at desc (newest first)
    rows.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}