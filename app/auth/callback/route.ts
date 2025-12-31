import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);

  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/select";

  // If no code, just go login
  if (!code) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, url.origin));
  }

  // IMPORTANT: always exchange the code on a client page
  return NextResponse.redirect(
    new URL(`/auth/exchange?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`, url.origin)
  );
}