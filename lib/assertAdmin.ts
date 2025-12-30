import crypto from "crypto";
import { cookies } from "next/headers";

const ADMIN_ID = process.env.ADMIN_ID!;
const ADMIN_SECRET = process.env.ADMIN_SECRET!;

function sign(payload: string) {
  return crypto.createHmac("sha256", ADMIN_SECRET).update(payload).digest("hex");
}

export async function assertAdmin() {
  const c = await cookies();
  const token = c.get("admin_token")?.value || "";
  const [ts, sig] = token.split(".");
  if (!ts || !sig) return false;

  const expected = sign(`${ADMIN_ID}.${ts}`);
  if (expected !== sig) return false;

  // 7 days expiry
  const ageMs = Date.now() - Number(ts);
  if (!Number.isFinite(ageMs) || ageMs > 7 * 24 * 60 * 60 * 1000) return false;

  return true;
}