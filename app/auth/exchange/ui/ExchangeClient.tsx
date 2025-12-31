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
  const [msg, setMsg] = useState("Exchanging link…");

  useEffect(() => {
    const run = async () => {
      const code = sp.get("code");
      const next = sp.get("next") || "/select";

      if (!code) {
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        setMsg("Link expired. Please login again.");
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      // ✅ Now session exists in browser -> go next
      router.replace(next);
    };

    run();
  }, [sp, router]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      {msg}
    </div>
  );
}