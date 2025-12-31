"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ExitClient() {
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get("code");

  const [msg, setMsg] = useState("Ending session...");

  useEffect(() => {
    const run = async () => {
      if (!code) {
        setMsg("Invalid QR");
        return;
      }

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setMsg("Please login to end your session");
        return;
      }

      const res = await fetch("/api/exit/consume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ exit_code: code }),
      });

      const out = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg(out?.error || "Failed to end session");
        return;
      }

      setMsg("Session ended successfully ✅");
      setTimeout(() => router.push("/"), 1500);
    };

    run();
  }, [code, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center">
        <p className="text-lg">{msg}</p>
      </div>
    </main>
  );
}