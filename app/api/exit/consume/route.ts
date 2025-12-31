import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { assertAdmin } from "../../../../lib/assertAdmin";

export async function POST(req: Request) {
  try {
    const { code } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // Find exit code record
    const { data: exitRow, error: findErr } = await admin
      .from("exit_codes")
      .select("id, session_id, used_at")
      .eq("code", code)
      .maybeSingle();

    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
    if (!exitRow) return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    if (exitRow.used_at) return NextResponse.json({ error: "Code already used" }, { status: 400 });

    // Mark used
    const { error: updErr } = await admin
      .from("exit_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", exitRow.id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    // OPTIONAL: you can also end the session here if you have status column
    // await admin.from("sessions").update({ status: "ended" }).eq("id", exitRow.session_id);

    return NextResponse.json({ ok: true, session_id: exitRow.session_id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}