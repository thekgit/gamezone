import { cookies } from "next/headers";

export async function assertAssistant() {
  const jar = await cookies(); // ✅ cookies() is async in Next 16
  const v = jar.get("assistant_auth")?.value;
  return v === "1";
}