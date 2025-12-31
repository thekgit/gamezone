import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";


export async function POST(req: Request) {
  try {
    const { user_id, game_id } = await req.json();

    if (!user_id || !game_id) {
      return NextResponse.json({ error: "Missing user_id or game_id" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data, error } = await admin.rpc("book_session", {
      p_game_id: game_id,
      p_user_id: user_id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ session: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}