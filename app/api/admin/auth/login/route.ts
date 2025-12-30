import { NextResponse } from "next/server";
import crypto from "crypto";

const ADMIN_ID = process.env.ADMIN_ID!;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;
const ADMIN_SECRET = process.env.ADMIN_SECRET!;

function sign(payload: string) {
  return crypto.createHmac("sha256", ADMIN_SECRET).update(payload).digest("hex");
}

export async function POST(req: Request) {
  const { adminId, password } = await req.json();

  if (String(adminId) !== ADMIN_ID || String(password) !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Login failed" }, { status: 401 });
  }

  const ts = Date.now().toString();
  const token = `${ts}.${sign(`${ADMIN_ID}.${ts}`)}`;

  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_token", token, {
    httpOnly: true,
    secure: false, // localhost
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}