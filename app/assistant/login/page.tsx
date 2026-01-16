"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AssistantLoginPage() {
  const router = useRouter();
  const [assistantId, setAssistantId] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/assistant/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantId, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Login failed");
        return;
      }

      router.replace("/assistant/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold text-center">Assistant Admin Login</h1>
        <p className="text-white/60 text-sm mt-1 text-center">
          Limited access panel (Visitors only).
        </p>

        <div className="mt-5 space-y-3">
          <input
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="Assistant ID"
            value={assistantId}
            onChange={(e) => setAssistantId(e.target.value)}
          />
          <input
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {msg && <div className="mt-3 text-sm text-red-300 text-center">{msg}</div>}

        <button
          onClick={onLogin}
          disabled={!assistantId || !password || loading}
          className="w-full mt-5 rounded-xl py-3 font-semibold bg-white text-black disabled:opacity-40"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>
    </main>
  );
}