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

  const code = sp.get("code");
  const next = sp.get("next") || "/set-password?next=/select";

  const [msg, setMsg] = useState("Verifying invite link…");

  useEffect(() => {
    (async () => {
      try {
        if (!code) {
          setMsg("Invite code missing. Please open the invite email again.");
          return;
        }

        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMsg(error.message || "Invite link expired. Please request again.");
          return;
        }

        router.replace(next);
      } catch {
        setMsg("Network/server error. Try again.");
      }
    })();
  }, [code, next, router]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-sm text-white/70">{msg}</div>
    </div>
  );
}