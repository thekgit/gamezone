"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setMsg("Not signed in. Please open the email link again.");
        setReady(false);
        return;
      }

      const { data: u } = await supabase.auth.getUser();
      setEmail(u.user?.email || "");
      setReady(true);
    };

    init();
  }, []);

  const canSubmit = ready && password.length >= 6 && password === confirm;

  const savePassword = async () => {
    setMsg("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMsg(error.message);
        return;
      }
      setMsg("Password saved! Redirecting...");
      setTimeout(() => router.replace("/select"), 700);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white px-4 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-3xl font-bold">Set Password</h1>
          <p className="text-white/60 mt-2 text-sm">
            User ID (email): <span className="text-white break-all">{email || "…"}</span>
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

        {msg && <div className="mt-3 text-sm text-white/80">{msg}</div>}

        <button
          disabled={!canSubmit || loading}
          onClick={savePassword}
          className="w-full mt-5 rounded-xl py-3 font-semibold bg-white text-black disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : "Save Password"}
        </button>
      </div>
    </main>
  );
}