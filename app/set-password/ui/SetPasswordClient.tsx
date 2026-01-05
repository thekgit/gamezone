"use client";

import { motion } from "framer-motion";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SetPasswordClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = sp.get("next") || "/home";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const canSave = password.trim().length >= 6 && password === confirm;

  const onSave = async () => {
    setMsg("");
    if (!canSave) return;

    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const jwt = sess?.session?.access_token;

      if (!jwt) {
        router.replace("/login");
        return;
      }

      // ✅ 1) Update Supabase Auth password
      const { error: upErr } = await supabase.auth.updateUser({
        password,
        data: { must_change_password: false },
      });

      if (upErr) {
        setMsg(upErr.message);
        return;
      }

      // ✅ 2) Mark password_set = true in your profiles (source of truth)
      const done = await fetch("/api/profile/password-set", {
        method: "POST",
        cache: "no-store",
        headers: { Authorization: `Bearer ${jwt}` },
      });

      const doneData = await done.json().catch(() => ({}));
      if (!done.ok) {
        setMsg(doneData?.error || "Password saved, but failed to update profile flags.");
        return;
      }

      router.replace(next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white px-4 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-3xl font-bold">Set new password</h1>
          <p className="text-white/60 mt-2 text-sm">
            This is required on your first login. After saving, you’ll continue.
          </p>
        </motion.div>

        <div className="space-y-3">
          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="New password (min 6)"
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

        {msg && <div className="mt-3 text-sm text-red-400">{msg}</div>}

        <button
          disabled={!canSave || loading}
          onClick={onSave}
          className="w-full mt-5 rounded-xl py-3 font-semibold bg-white text-black disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : "Save Password"}
        </button>
      </div>
    </main>
  );
}