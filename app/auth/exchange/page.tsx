"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function ExchangeInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [msg, setMsg] = useState("Signing you in...");

  useEffect(() => {
    const run = async () => {
      const code = sp.get("code");
      const next = sp.get("next") || "/select";

      if (!code) {
        router.replace("/login");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        setMsg("Invite link invalid/expired. Please login or request again.");
        return;
      }

      router.replace(next);
    };

    run();
  }, [sp, router]);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="text-sm text-white/80">{msg}</div>
    </main>
  );
}

export default function ExchangePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>}>
      <ExchangeInner />
    </Suspense>
  );
}