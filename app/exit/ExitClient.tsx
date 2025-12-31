"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ExitClient() {
  const sp = useSearchParams();
  const code = sp.get("code"); // or session_id, whatever you use
  const [msg, setMsg] = useState<string>("Processing...");

  useEffect(() => {
    const run = async () => {
      try {
        if (!code) {
          setMsg("Missing exit code.");
          return;
        }

        // Example: call your consume API (adjust endpoint/body to your project)
        const res = await fetch("/api/exit/consume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setMsg(data?.error || "Invalid or expired code.");
          return;
        }

        setMsg("✅ Exit recorded successfully.");
      } catch {
        setMsg("Server/network error.");
      }
    };

    run();
  }, [code]);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold">Exit</h1>
        <p className="mt-3 text-white/70">{msg}</p>
      </div>
    </main>
  );
}