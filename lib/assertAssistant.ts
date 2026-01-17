import { cookies } from "next/headers";

export async function assertAssistant() {
  const c = (await cookies()).get("assistant_auth")?.value;
  return c === "1";
}