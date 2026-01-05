import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// This endpoint ONLY checks whether the logged-in user MUST change password.
// - Imported/admin-created users => user_metadata.must_change_password = true
// - Existing users => false
// - Normal signup users => they already go to /set-password via email link (unchanged)
export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!jwt) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const { data, error } = await supabase.auth.getUser(jwt);
    if (error || !data?.user) {
      return NextResponse.json({ error: error?.message || "Invalid session" }, { status: 401 });
    }

    const must_change_password = data.user.user_metadata?.must_change_password === true;

    return NextResponse.json({
      ok: true,
      must_change_password,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}