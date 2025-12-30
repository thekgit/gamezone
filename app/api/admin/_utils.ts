import crypto from "crypto";
import { cookies } from "next/headers";

const ADMIN_ID = process.env.ADMIN_ID!;
const ADMIN_SECRET = process.env.ADMIN_SECRET!;

function sign(payload: string) {
  return crypto
    .createHmac("sha256", ADMIN_SECRET)
    .update(payload)
    .digest("hex");
}

/**
 * Server-only admin check
 * Must be awaited
 */
export async function assertAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;

  if (!token) return false;

  const [ts, sig] = token.split(".");
  if (!ts || !sig) return false;

  const expected = sign(`${ADMIN_ID}.${ts}`);
  if (expected !== sig) return false;

  // Expire after 7 days
  const ageMs = Date.now() - Number(ts);
  if (!Number.isFinite(ageMs) || ageMs > 7 * 24 * 60 * 60 * 1000) {
    return false;
  }

  return true;
}