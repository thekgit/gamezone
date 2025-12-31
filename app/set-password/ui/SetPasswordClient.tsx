"use client";

import { motion } from "framer-motion";
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

  // ✅ after password is set, go here (default: /select)
  const next = sp.get("next") || "/select";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = password.trim().length >= 6 && password === confirm;

  const onSetPassword = async () => {
    setMsg("");
    setLoading(true);

    try {
      // ✅ user must already have a session at this point (invite link -> /auth/callback -> /auth/exchange -> here)
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setMsg("Session missing. Please open the invite link again from email.");
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (error) {
        setMsg(error.message || "Failed to set password");
        return;
      }

      // ✅ go to booking page
      router.replace(next);
    } catch (e: any) {
      setMsg("Network/server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white px-4 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-3xl font-bold">Set new password</h1>
          <p className="text-white/60 mt-2 text-sm">
            Create a password for your account to continue.
          </p>
        </motion.div>

        <div className="space-y-3">
          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="New password (min 6 chars)"
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
          disabled={!canSubmit || loading}
          onClick={onSetPassword}
          className="w-full mt-5 rounded-xl py-3 font-semibold bg-white text-black disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : "Set Password & Continue"}
        </button>
      </div>
    </main>
  );
}