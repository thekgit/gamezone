import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";

  if (!code) return NextResponse.redirect(new URL("/", url.origin));

  // If you're using supabase-js client auth in browser, you can skip this.
  // But for invite flows, simplest is: just redirect to a client page that calls exchangeCodeForSession.
  return NextResponse.redirect(new URL(`/auth/exchange?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`, url.origin));
}