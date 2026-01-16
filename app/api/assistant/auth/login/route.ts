import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const assistantId = String(body?.assistantId || "").trim();
    const password = String(body?.password || "").trim();

    // ✅ Replace these with your real credentials (env preferred)
    const OK_ID = process.env.ASSISTANT_ID || "assistant";
    const OK_PASS = process.env.ASSISTANT_PASSWORD || "A12345";

    if (assistantId !== OK_ID || password !== OK_PASS) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });

    // ✅ set cookie
    res.cookies.set("assistant_auth", "1", {
      httpOnly: true,
      secure: true,        // keep true for vercel/prod
      sameSite: "lax",
      path: "/",           // ✅ important
      maxAge: 60 * 60 * 12 // 12 hours
    });

    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}