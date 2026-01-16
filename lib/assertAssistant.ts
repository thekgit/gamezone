import { cookies } from "next/headers";

export function assertAssistant() {
  // cookie set by /api/assistant/auth/login
  const c = cookies().get("assistant_auth")?.value || "";
  if (!c) return false;

  // basic "true" gate; you can extend later (role, expiry, etc.)
  return c === "1";
}