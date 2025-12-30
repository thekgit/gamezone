import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import crypto from "crypto";

const ADMIN_ID = process.env.ADMIN_ID!;
const ADMIN_SECRET = process.env.ADMIN_SECRET!;

function sign(payload: string) {
  return crypto.createHmac("sha256", ADMIN_SECRET).update(payload).digest("hex");
}

function isAdmin(req: NextRequest) {
  const token = req.cookies.get("admin_token")?.value || "";
  const [ts, sig] = token.split(".");
  if (!ts || !sig) return false;
  const expected = sign(`${ADMIN_ID}.${ts}`);
  if (expected !== sig) return false;
  const ageMs = Date.now() - Number(ts);
  if (!Number.isFinite(ageMs) || ageMs > 7 * 24 * 60 * 60 * 1000) return false;
  return true;
}

export async function GET(req: NextRequest) {
  try {
    if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = supabaseAdmin();

    // sessions -> profiles (user_id), games, slots
    const { data, error } = await admin
      .from("sessions")
      .select(`
        id,
        created_at,
        user_id,
        profiles:profiles!sessions_user_id_profiles_fkey(full_name, email, phone),
        games:games(name),
        slots:slots(start_time, end_time)
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data || []).map((r: any) => {
      const slotLabel =
        r?.slots?.start_time && r?.slots?.end_time
          ? `${new Date(r.slots.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${new Date(
              r.slots.end_time
            ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : null;

      return {
        id: r.id,
        created_at: r.created_at,
        user_id: r.user_id,
        full_name: r.profiles?.full_name ?? null,
        email: r.profiles?.email ?? null,
        phone: r.profiles?.phone ?? null,
        game_name: r.games?.name ?? null,
        slot_label: slotLabel,
      };
    });

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}