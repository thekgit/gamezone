import { cookies } from "next/headers";

export async function assertAssistant() {
  const store = await cookies(); // ✅ Next.js 16: cookies() is async
  const c = store.get("assistant_auth")?.value;
  return c === "1";
}