import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdmin } from "@/lib/assertAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    if (!assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user_id, email } = await req.json().catch(() => ({}));

    const uid = String(user_id || "").trim();
    const em = String(email || "").trim().toLowerCase();

    if (!uid) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // ------------------------------------------------------------
    // ✅ CRITICAL FIX: KEEP sessions forever
    // 1) Read profile once (so we can preserve display info in sessions)
    // 2) Detach sessions by setting user_id = null
    // 3) Optionally snapshot visitor info into sessions if your columns exist
    // ------------------------------------------------------------

    // 1) Read profile details (safe even if missing)
    const { data: prof } = await admin
      .from("profiles")
      .select("full_name, phone, email")
      .eq("user_id", uid)
      .maybeSingle();

    const full_name = String(prof?.full_name || "").trim();
    const phone = String(prof?.phone || "").trim();
    const profileEmail = String(prof?.email || em || "").trim().toLowerCase();

    // 2) Try to snapshot visitor fields (ONLY if your sessions table supports these columns).
    // If your sessions table does NOT have visitor_name/visitor_phone/visitor_email,
    // this update will fail — so we wrap it and continue.
    // (This is to keep Visitors page showing details after user deletion.)
    try {
      await admin
        .from("sessions")
        .update({
          // keep snapshots only if present in schema
          visitor_name: full_name || null,
          visitor_phone: phone || null,
          visitor_email: profileEmail || null,
        } as any)
        .eq("user_id", uid);
    } catch {
      // ignore snapshot failure (columns may not exist)
    }

    // 3) Detach sessions so FK never cascades and joins don't remove rows
    const { error: sessDetachErr } = await admin
      .from("sessions")
      .update({ user_id: null } as any)
      .eq("user_id", uid);

    if (sessDetachErr) {
      return NextResponse.json(
        { error: `Failed to detach sessions: ${sessDetachErr.message}` },
        { status: 500 }
      );
    }

    // ------------------------------------------------------------
    // ✅ Now safe to delete user/profile without losing sessions
    // ------------------------------------------------------------

    // Delete profile
    const { error: профErr } = await admin.from("profiles").delete().eq("user_id", uid);
    if (профErr) {
      return NextResponse.json({ error: профErr.message }, { status: 500 });
    }

    // Delete auth user
    const { error: authErr } = await admin.auth.admin.deleteUser(uid);
    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 500 });
    }

    // Delete company_employees row (if email provided)
    if (profileEmail) {
      const { error: empErr } = await admin
        .from("company_employees")
        .delete()
        .eq("email", profileEmail);

      // Not fatal — user may not exist here
      if (empErr) {
        // keep going
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}