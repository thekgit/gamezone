"use client";

import { motion } from "framer-motion";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useState } from "react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SetPasswordClient({ next }: { next: string }) {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const canSave = password.trim().length >= 6 && password === confirm;

  const onSave = async () => {
    setMsg("");
    if (!canSave) {
      setMsg("Password must be at least 6 characters and match confirmation.");
      return;
    }

    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) {
        router.replace("/login");
        return;
      }

      // ✅ Update password + clear the "must change" flag
      const { error } = await supabase.auth.updateUser({
        password,
        data: { must_change_password: false },
      });

      if (error) {
        setMsg(error.message);
        return;
      }

      router.replace(next || "/home");
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
            This is required on your first login. After saving, you’ll continue to your dashboard.
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