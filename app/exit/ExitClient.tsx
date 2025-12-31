"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ExitClient({ token }: { token: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string>("Processing exit…");
  const [done, setDone] = useState(false);
  const [duration, setDuration] = useState<string>("");

  useEffect(() => {
    (async () => {
      if (!token) {
        setMsg("Invalid QR (missing info).");
        return;
      }

      // If not logged in, send to login and come back here (same token)
      const { data } = await supabase.auth.getSession();
      const access = data.session?.access_token;

      if (!access) {
        const next = `/exit?token=${encodeURIComponent(token)}`;
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      // Call exit consume API (ends session)
      const res = await fetch("/api/exit/consume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({ token }),
      });

      const out = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg(out?.error || "Invalid/expired QR.");
        return;
      }

      setDone(true);
      setDuration(out?.played || "");
      setMsg("✅ Session ended successfully.");
    })();
  }, [token, router]);

  return (
    <main className="min-h-screen bg-black text-white px-4 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
        <h1 className="text-2xl font-bold mb-2">Exit</h1>

        {!done ? (
          <p className="text-white/70">{msg}</p>
        ) : (
          <>
            <p className="text-white/80">{msg}</p>
            {duration && (
              <div className="mt-3 text-sm text-white/60">
                Total time played: <span className="text-white">{duration}</span>
              </div>
            )}

            <button
              className="mt-5 w-full rounded-xl py-3 font-semibold bg-white text-black"
              onClick={() => router.replace("/select")}
            >
              Back to Booking
            </button>
          </>
        )}
      </div>
    </main>
  );
}