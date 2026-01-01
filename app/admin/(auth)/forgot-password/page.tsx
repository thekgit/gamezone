"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sendReset = async () => {
    setMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });

    setLoading(false);

    if (error) return setMsg(error.message);
    setMsg("✅ Password reset link sent to your email.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0b0b] text-white p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold">Forgot Password</h1>
        <p className="text-sm text-white/60 mt-1">
          Enter your email and we’ll send a reset link.
        </p>

        <div className="mt-5 space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
          />

          <button
            onClick={sendReset}
            disabled={!email.trim() || loading}
            className="w-full rounded-xl py-3 font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>

          {msg && <div className="text-sm text-white/80">{msg}</div>}

          <a href="/admin/login" className="text-sm text-blue-400 hover:text-blue-300">
            Back to login
          </a>
        </div>
      </div>
    </div>
  );
}