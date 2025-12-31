"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SetPasswordClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = sp.get("next") || "/select";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = password.length >= 6 && password === confirm;

  const onSave = async () => {
    setMsg("");
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();

      // ✅ If user reached here without session, do NOT redirect to login automatically
      if (!data.session) {
        setMsg("Session missing. Please open the invite email link again.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMsg(error.message || "Failed to set password");
        return;
      }

      router.replace(next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold">Set Password</h1>
        <p className="text-white/60 mt-2 text-sm">Create a password to continue.</p>

        <div className="mt-5 space-y-3">
          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none"
            type="password"
            placeholder="New password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none"
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {msg && <div className="mt-3 text-sm text-red-300">{msg}</div>}

        <button
          onClick={onSave}
          disabled={!canSubmit || loading}
          className="w-full mt-5 rounded-xl py-3 font-semibold bg-white text-black disabled:opacity-40"
        >
          {loading ? "Saving..." : "Set Password & Continue"}
        </button>
      </div>
    </main>
  );
}