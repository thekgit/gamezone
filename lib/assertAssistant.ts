import { cookies } from "next/headers";

export function assertAssistant() {
  const c = cookies().get("assistant_auth")?.value;
  return c === "1";
}