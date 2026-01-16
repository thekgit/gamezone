import { cookies } from "next/headers";

export async function assertAssistant() {
  // Next 16: cookies() is async
  const jar = await cookies();
  const c = jar.get("assistant_auth")?.value || "";
  return c === "1";
}