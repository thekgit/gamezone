import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// anon client ONLY to validate JWT
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

    // ---- AUTH ----
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return NextResponse.json(
        { error: "Missing auth token", profiles: [] },
        { status: 401 }
      );
    }

    const anon = supabaseAnon();
    const { data: meRes, error: meErr } = await anon.auth.getUser(token);

    if (meErr || !meRes?.user?.id) {
      return NextResponse.json(
        { error: "Invalid session", profiles: [] },
        { status: 401 }
      );
    }

    const myUserId = meRes.user.id;

    // ---- SEARCH ----
    const admin = supabaseAdmin();

    const { data, error } = await admin
      .from("profiles")
      .select("user_id, full_name, email, employee_id, phone")
      .or(
        `full_name.ilike.%${q}%,email.ilike.%${q}%,employee_id.ilike.%${q}%`
      )
      .order("full_name", { ascending: true })
      .limit(20);

    if (error) {
      return NextResponse.json(
        { error: error.message, profiles: [] },
        { status: 500 }
      );
    }

    // ---- FILTER SELF ----
    const profiles = (data || [])
      .filter((p: any) => String(p.user_id) !== String(myUserId))
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
      { error: e?.message || "Server error", profiles: [] },
      { status: 500 }
    );
  }
}