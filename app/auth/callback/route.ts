import { NextResponse } from "next/server";
export async function GET(req: Request) {
  const url = new URL(req.url);

  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";

  if (!code) {
    return NextResponse.redirect(new URL("/", url.origin));
  }

  // Redirect to a client page which will exchange code for session.
  return NextResponse.redirect(
    new URL(
      `/auth/exchange?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`,
      url.origin
    )
  );
}