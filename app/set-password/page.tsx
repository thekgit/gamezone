"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // must be logged in from invite
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const sp = new URLSearchParams(window.location.search);
        const next = sp.get("next") || "/select";
        window.location.replace(`/login?next=${encodeURIComponent("/set-password?next=" + next)}`);
      }
    })();
  }, []);

  const onSet = async () => {
    setMsg("");
    if (!password || password.length < 6) return setMsg("Password must be at least 6 characters.");
    if (password !== confirm) return setMsg("Passwords do not match.");

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return setMsg(error.message);

      const sp = new URLSearchParams(window.location.search);
      const next = sp.get("next") || "/select";
      window.location.replace(next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-5">
        <h1 className="text-2xl font-bold">Set Password</h1>
        <p className="text-white/60 text-sm mt-2">
          Create your new password to continue.
        </p>

        <div className="mt-4 space-y-3">
          <input
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="Confirm password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {msg && <div className="mt-3 text-sm text-red-300">{msg}</div>}

        <button
          onClick={onSet}
          disabled={loading}
          className="mt-5 w-full rounded-xl bg-white text-black py-3 font-semibold disabled:opacity-40"
        >
          {loading ? "Saving..." : "Save & Continue"}
        </button>
      </div>
    </main>
  );
}