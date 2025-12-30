import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
  try {
    const { full_name, phone, email } = await req.json();

    const fullName = String(full_name || "").trim();
    const phoneNum = String(phone || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!fullName || !phoneNum || !cleanEmail) {
      return NextResponse.json({ error: "full_name, phone, email required" }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Create user (or get existing) with metadata
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: cleanEmail,
      email_confirm: false,
      user_metadata: { full_name: fullName, phone: phoneNum },
    });

    if (createErr && !createErr.message.toLowerCase().includes("already registered")) {
      return NextResponse.json({ error: createErr.message }, { status: 500 });
    }

    // If already exists, fetch user by email
    let userId = created?.user?.id;
    if (!userId) {
      const { data: users, error: listErr } = await admin.auth.admin.listUsers();
      if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

      const u = users.users.find((x) => (x.email || "").toLowerCase() === cleanEmail);
      if (!u?.id) return NextResponse.json({ error: "User not found after create" }, { status: 500 });
      userId = u.id;

      // also update metadata for existing user
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: { full_name: fullName, phone: phoneNum },
      });
    }

    // Upsert profile by user_id (CORRECT)
    const { error: profErr } = await admin.from("profiles").upsert(
      [{ user_id: userId, full_name: fullName, phone: phoneNum, email: cleanEmail }],
      { onConflict: "user_id" }
    );
    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

    // Send invite/set-password email (option A)
    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(cleanEmail, {
      redirectTo: "http://localhost:3000/set-password",
    });
    if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, message: "Email sent. Open it to set password." });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}