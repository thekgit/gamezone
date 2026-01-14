import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = String(url.searchParams.get("q") || "").trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ profiles: [] }, { status: 200 });
    }

    // Require Bearer token
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    // Validate token -> get current user id
    const anon = supabaseAnon();
    const { data: meRes, error: meErr } = await anon.auth.getUser(token);

    if (meErr || !meRes?.user?.id) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const meId = meRes.user.id;

    const admin = supabaseAdmin();

    // IMPORTANT: escape % and _ so ilike doesn't behave weird
    const safe = q.replace(/[%_]/g, "\\$&");

    const { data, error } = await admin
      .from("profiles")
      .select("user_id, full_name, email, employee_id, phone")
      .or(
        `full_name.ilike.%${safe}%,email.ilike.%${safe}%,employee_id.ilike.%${safe}%`
      )
      .order("full_name", { ascending: true })
      .limit(15);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const profiles = (data || [])
      .filter((p: any) => String(p.user_id) !== String(meId))
      .map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name ?? "",
        email: p.email ?? "",
        employee_id: p.employee_id ?? "",
        phone: p.phone ?? "",
      }));

    return NextResponse.json({ profiles }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}