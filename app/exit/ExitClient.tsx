"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ExitClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const sid = sp.get("sid") || "";
  const token = sp.get("token") || "";

  const [msg, setMsg] = useState("Processing exit…");

  useEffect(() => {
    (async () => {
      if (!sid || !token) {
        setMsg("Invalid QR (missing info).");
        return;
      }

      const { data } = await supabase.auth.getSession();
      const access = data.session?.access_token;

      // Not logged in → send to login and come back here
      if (!access) {
        const next = `/exit?sid=${encodeURIComponent(sid)}&token=${encodeURIComponent(token)}`;
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      // Logged in → consume exit
      const res = await fetch("/api/exit/consume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({ sid, token }),
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(out?.error || "Invalid / expired QR");
        return;
      }

      setMsg("✅ Slot ended successfully.");
      setTimeout(() => router.replace("/select"), 1200);
    })();
  }, [sid, token, router]);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <h1 className="text-2xl font-bold">Exit</h1>
        <p className="text-white/70 mt-3">{msg}</p>
      </div>
    </main>
  );
}