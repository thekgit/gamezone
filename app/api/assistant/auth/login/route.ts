import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Put in Vercel env:
// ASSISTANT_ADMIN_ID=assistant1
// ASSISTANT_ADMIN_PASSWORD=SomeStrongPass
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body?.assistantId || "").trim();
    const password = String(body?.password || "").trim();

    const ok =
      id === String(process.env.ASSISTANT_ADMIN_ID || "").trim() &&
      password === String(process.env.ASSISTANT_ADMIN_PASSWORD || "").trim();

    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true }, { status: 200 });

    // cookie on same domain, httpOnly
    res.cookies.set("assistant_auth", "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}