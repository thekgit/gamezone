"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ExchangeClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    const run = async () => {
      const code = sp.get("code");
      const next = sp.get("next") || "/set-password?next=/select";

      if (!code) {
        setMsg("Missing code.");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        setMsg(error.message || "Failed to sign in.");
        return;
      }

      router.replace(next);
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="text-sm text-white/80">{msg}</div>
    </main>
  );
}