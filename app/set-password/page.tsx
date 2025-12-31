"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SetPasswordPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/select";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const onSet = async () => {
    setMsg("");

    if (password.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setMsg("Session missing. Please open the email link again.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMsg(error.message);
        return;
      }

      // ✅ SUCCESS: go straight to booking page
      router.replace(next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold">Set Password</h1>
        <p className="text-white/60 mt-2 text-sm">
          Create a new password to continue.
        </p>

        <div className="mt-5 space-y-3">
          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="Confirm password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {msg && <div className="mt-3 text-sm text-red-300">{msg}</div>}

        <button
          disabled={loading}
          onClick={onSet}
          className="w-full mt-5 rounded-xl py-3 font-semibold bg-white text-black disabled:opacity-40"
        >
          {loading ? "Saving..." : "Save Password"}
        </button>
      </div>
    </main>
  );
}