"use client";

import { Suspense, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function ExitInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const session_id = sp.get("session_id") || "";
  const token = sp.get("token") || "";

  const [msg, setMsg] = useState("Checking login...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!session_id || !token) {
        setMsg("Invalid QR link.");
        setLoading(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      const access_token = data.session?.access_token;

      if (!access_token) {
        // send to login and come back here
        const next = `/exit?session_id=${encodeURIComponent(session_id)}&token=${encodeURIComponent(token)}`;
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      // logged in -> consume exit
      setMsg("Ending your slot...");
      const res = await fetch("/api/exit/consume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access_token}`,
        },
        body: JSON.stringify({ session_id, token }),
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(out?.error || "Failed to end slot.");
        setLoading(false);
        return;
      }

      setMsg("✅ Slot ended successfully.");
      setLoading(false);
    };

    run();
  }, [router, session_id, token]);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold mb-2">Exit</h1>
        <p className="text-white/70">{msg}</p>
        {!loading && (
          <button
            className="mt-5 rounded-xl bg-white text-black px-4 py-2 font-semibold"
            onClick={() => router.replace("/")}
          >
            Go Home
          </button>
        )}
      </div>
    </main>
  );
}

export default function ExitPage() {
  // ✅ fixes "useSearchParams should be wrapped in suspense"
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>}>
      <ExitInner />
    </Suspense>
  );
}