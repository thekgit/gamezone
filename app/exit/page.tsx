"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ExitPage() {
  const sp = useSearchParams();
  const code = sp.get("code") || "";
  const [msg, setMsg] = useState("Ending session...");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/exit/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg(data?.error || "Failed to end session");
      else setMsg("✅ Session ended successfully");
    })();
  }, [code]);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="max-w-sm w-full rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <div className="text-xl font-bold">{msg}</div>
      </div>
    </main>
  );
}