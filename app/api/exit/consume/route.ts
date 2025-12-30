import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  if (!h.toLowerCase().startsWith("bearer ")) return "";
  return h.slice(7).trim();
}

export async function POST(req: Request) {
  try {
    const token = getBearer(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { code } = await req.json();
    if (!code) return NextResponse.json({ error: "Invalid code" }, { status: 400 });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // user from token
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user_id = userData.user.id;

    // find exit code
    const { data: ec, error: ecErr } = await supabaseAdmin
      .from("exit_codes")
      .select("id,session_id,expires_at,used_at")
      .eq("code", code)
      .single();

    if (ecErr || !ec) return NextResponse.json({ error: "Invalid/expired code" }, { status: 400 });
    if (ec.used_at) return NextResponse.json({ error: "Code already used" }, { status: 400 });
    if (new Date(ec.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "Code expired" }, { status: 400 });

    // session must belong to same user
    const { data: sess, error: sErr } = await supabaseAdmin
      .from("sessions")
      .select("id,user_id,status")
      .eq("id", ec.session_id)
      .single();

    if (sErr || !sess) return NextResponse.json({ error: "Session not found" }, { status: 400 });
    if (sess.user_id !== user_id) return NextResponse.json({ error: "This exit QR is not for you." }, { status: 403 });
    if (sess.status !== "active") return NextResponse.json({ error: "Session already ended" }, { status: 400 });

    // end session + mark code used
    await supabaseAdmin
      .from("sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", sess.id);

    await supabaseAdmin
      .from("exit_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", ec.id);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  const admin = supabaseAdmin();

  // End ONLY the session that currently has this exit_token
  const { data, error } = await admin
    .from("sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("exit_token", code)
    .eq("status", "active")
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Invalid/expired exit code" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}