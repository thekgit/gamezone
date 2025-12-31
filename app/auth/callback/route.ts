import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/set-password?next=/select";

  if (!code) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, url.origin));
  }

  return NextResponse.redirect(
    new URL(`/auth/exchange?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`, url.origin)
  );
}