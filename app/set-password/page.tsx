"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function SetPasswordInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/select";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace(`/login?next=${encodeURIComponent("/set-password?next=/select")}`);
      }
    })();
  }, [router]);

  const onSave = async () => {
    setMsg("");
    setLoading(true);

    try {
      if (password.trim().length < 6) return setMsg("Password must be at least 6 characters.");
      if (password !== confirm) return setMsg("Passwords do not match.");

      const { error } = await supabase.auth.updateUser({ password: password.trim() });
      if (error) return setMsg(error.message);

      router.replace(next); // -> /select
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold">Set New Password</h1>
        <p className="text-white/60 text-sm mt-2">Create your password to continue.</p>

        <input
          className="mt-4 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          className="mt-3 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
          type="password"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        {msg && <div className="mt-3 text-sm text-red-300">{msg}</div>}

        <button
          onClick={onSave}
          disabled={loading}
          className="mt-4 w-full rounded-xl py-3 font-semibold bg-white text-black disabled:opacity-40"
        >
          {loading ? "Saving..." : "Save & Continue"}
        </button>
      </div>
    </main>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>}>
      <SetPasswordInner />
    </Suspense>
  );
}