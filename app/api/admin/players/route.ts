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
      return NextResponse.json({ users: [] }, { status: 200 });
    }

    // Identify current user (must be logged in)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const anon = supabaseAnon();
    const { data: meRes, error: meErr } = await anon.auth.getUser(token);
    if (meErr || !meRes?.user?.id) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const meId = meRes.user.id;

    // Search profiles (service role so we can search)
    const admin = supabaseAdmin();

    // Use ilike on three fields (OR). Keep result small.
    const { data, error } = await admin
      .from("profiles")
      .select("user_id, full_name, email, employee_id, phone")
      .or(
        `full_name.ilike.%${q}%,email.ilike.%${q}%,employee_id.ilike.%${q}%`
      )
      .order("full_name", { ascending: true })
      .limit(15);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Don't show self in results
    const users = (data || [])
      .filter((u: any) => String(u.user_id) !== String(meId))
      .map((u: any) => ({
        user_id: u.user_id,
        full_name: u.full_name ?? "",
        email: u.email ?? "",
        employee_id: u.employee_id ?? "",
        phone: u.phone ?? "",
      }));

    return NextResponse.json({ users }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}