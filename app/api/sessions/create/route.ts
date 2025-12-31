import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const game_id = body?.game_id;
    const players = body?.players ?? 1;

    if (!game_id) {
      return NextResponse.json({ error: "Missing game_id" }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    // Create session (slot starts now, lasts 1 hour)
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        game_id,
        players,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: "active",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session: data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}