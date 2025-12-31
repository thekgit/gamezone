import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/set-password?next=/select";

  if (!code) {
    // if no code, go home (or login if you want)
    return NextResponse.redirect(new URL("/", url.origin));
  }

  // ✅ Send to exchange page (client) to create session
  const dest = `/auth/exchange?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(new URL(dest, url.origin));
}