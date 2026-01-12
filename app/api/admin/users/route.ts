import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/assertAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(req: Request) {
    try {
      if (!assertAdmin()) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
  
      const body = await req.json().catch(() => ({}));
      const user_id = String(body?.user_id || "").trim();
  
      if (!user_id) {
        return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
      }
  
      // Only editable fields (email not editable)
      const payload: {
        full_name?: string;
        phone?: string;
        employee_id?: string;
        company?: string;
      } = {};
  
      if (body.full_name !== undefined) payload.full_name = String(body.full_name || "").trim();
      if (body.phone !== undefined) payload.phone = String(body.phone || "").trim();
      if (body.employee_id !== undefined) payload.employee_id = String(body.employee_id || "").trim();
      if (body.company !== undefined) payload.company = String(body.company || "").trim();
  
      if (Object.keys(payload).length === 0) {
        return NextResponse.json({ error: "No fields to update" }, { status: 400 });
      }
  
      const admin = supabaseAdmin();
  
      const { error } = await admin
        .from("profiles")
        .update(payload)
        .eq("user_id", user_id);
  
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
  
      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.message || "Server error" },
        { status: 500 }
      );
    }
  }