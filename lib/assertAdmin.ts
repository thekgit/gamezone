import { cookies } from "next/headers";

export async function assertAssistant(): Promise<boolean> {
  const jar = await cookies(); // ✅ cookies() is async in your Next.js
  const v = jar.get("assistant_auth")?.value || "";
  return v === "1";
}