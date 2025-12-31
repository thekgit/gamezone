import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/select";

  if (!code) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  // Send to client page that exchanges code -> session
  return NextResponse.redirect(
    new URL(`/auth/exchange?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`, url.origin)
  );
}