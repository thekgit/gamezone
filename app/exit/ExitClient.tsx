"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ExitClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const token = sp.get("token") || "";

  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setStatus("error");
        setMsg("Invalid QR (missing info).");
        return;
      }

      setStatus("working");
      setMsg("");

      // ✅ ensure user is logged in
      const { data } = await supabase.auth.getSession();
      const access = data.session?.access_token;

      if (!access) {
        // send to login, then come back here and auto-end
        router.replace(`/login?next=${encodeURIComponent(`/exit?token=${token}`)}`);
        return;
      }

      // ✅ end session
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
        setStatus("error");
        setMsg(out?.error || "Invalid/expired QR.");
        return;
      }

      setMinutes(out?.durationMinutes ?? null);
      setStatus("done");
    };

    run();
  }, [token, router]);

  if (status === "working") {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 text-center">
        <div className="max-w-sm w-full rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-2xl font-bold">Exit</div>
          <div className="mt-2 text-white/60">Ending your session…</div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 text-center">
        <div className="max-w-sm w-full rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-2xl font-bold">Exit</div>
          <div className="mt-2 text-red-300">{msg || "Invalid/expired QR."}</div>
          <button
            onClick={() => router.replace("/select")}
            className="mt-5 w-full rounded-xl py-3 font-semibold bg-white text-black"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 text-center">
        <div className="max-w-sm w-full rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-2xl font-bold">Thanks for visiting 🎉</div>
          <div className="mt-2 text-white/70">
            Your session has ended successfully.
          </div>

          {minutes != null && (
            <div className="mt-4 text-white/80">
              Total time played: <span className="font-semibold">{minutes} min</span>
            </div>
          )}

          <button
            onClick={() => router.replace("/select")}
            className="mt-6 w-full rounded-xl py-3 font-semibold bg-white text-black"
          >
            Back to Booking
          </button>
        </div>
      </div>
    );
  }

  // idle fallback
  return null;
}