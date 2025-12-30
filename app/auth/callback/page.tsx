"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [msg, setMsg] = useState("Signing you in...");

  useEffect(() => {
    const run = async () => {
      const code = params.get("code");

      // ✅ THIS is what creates the session from the email link
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMsg("Login failed. Please open the email link again.");
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setMsg("Session not found. Please open the email link again.");
        return;
      }

      // Save pending profile (optional)
      const pending = localStorage.getItem("pending_profile");
      if (pending) {
        await fetch("/api/profile/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: pending,
        });
        localStorage.removeItem("pending_profile");
      }

      setMsg("Signed in. Redirecting...");
      router.replace("/set-password");
    };

    run();
  }, [params, router]);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-xl font-bold">GameZone</h1>
        <p className="text-white/70 mt-2 text-sm">{msg}</p>
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackInner />
    </Suspense>
  );
}