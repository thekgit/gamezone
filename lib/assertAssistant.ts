import { cookies } from "next/headers";

export async function assertAssistant(): Promise<boolean> {
  const jar = await cookies();
  const v = jar.get("assistant_auth")?.value || "";
  return v === "1";
}