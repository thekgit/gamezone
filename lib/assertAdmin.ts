import { cookies } from "next/headers";

export async function assertAdmin(): Promise<boolean> {
  const jar = await cookies(); // ✅ Next.js 16 cookies() is async
  const v = jar.get("admin_auth")?.value || "";
  return v === "1";
}