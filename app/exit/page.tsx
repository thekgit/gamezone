"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ExitPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");

  useEffect(() => {
    const run = async () => {
      if (!token) {
        alert("Invalid QR");
        return;
      }

      const { data } = await supabase.auth.getSession();

      // 🔴 Not logged in → redirect to login
      if (!data.session) {
        router.replace(`/login?next=/exit?token=${encodeURIComponent(token)}`);
        return;
      }

      // 🟢 Logged in → auto end session
      const res = await fetch("/api/exit/consume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ token }),
      });

      const out = await res.json();

      if (!res.ok) {
        alert(out.error || "Invalid or expired QR");
        return;
      }

      alert("Session ended successfully");
      router.replace("/");
    };

    run();
  }, [token, router]);

  return <p className="text-white p-6">Processing exit…</p>;
}