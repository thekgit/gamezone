import { Suspense } from "react";
import LoginClient from "./ui/LoginClient";

export const dynamic = "force-dynamic"; // ✅ important for Vercel/export issues

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading…</div>}>
      <LoginClient />
    </Suspense>
  );
}