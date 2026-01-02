"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useSearchParams, useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ExitClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const session_id = sp.get("session_id") || "";
  const token = sp.get("token") || "";

  const [msg, setMsg] = useState("Ending session...");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setError("");

      if (!session_id || !token) {
        setError("Invalid QR (missing session_id/token)");
        return;
      }

      // must be logged in (only owner can end)
      const { data } = await supabase.auth.getSession();
      const jwt = data?.session?.access_token;

      if (!jwt) {
        // send user to login, then come back to this exit url
        const next = encodeURIComponent(`/exit?session_id=${session_id}&token=${token}`);
        router.replace(`/login?next=${next}`);
        return;
      }

      const res = await fetch("/api/exit/consume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ session_id, token }),
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out?.error || "Failed to end session");
        return;
      }

      setMsg(out?.alreadyEnded ? "Session already ended ✅" : "Session ended ✅");
    })();
  }, [session_id, token, router]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold">Exit</h1>
        <p className="text-white/60 text-sm mt-2">
          Scan QR to end your session.
        </p>

        {error ? (
          <div className="mt-4 text-red-300 text-sm">{error}</div>
        ) : (
          <div className="mt-4 text-green-300 text-sm">{msg}</div>
        )}
      </div>
    </div>
  );
}