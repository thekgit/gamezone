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

  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setMsg("");
    if (p1.length < 6) return setMsg("Password must be at least 6 characters.");
    if (p1 !== p2) return setMsg("Passwords do not match.");

    setLoading(true);
    try {
      // Must have a session already (from /auth/exchange)
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace(`/login?next=${encodeURIComponent("/set-password?next=" + next)}`);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: p1 });
      if (error) {
        setMsg(error.message);
        return;
      }

      router.replace(next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-4">
        <h1 className="text-2xl font-bold">Set new password</h1>
        <p className="text-white/60 text-sm mt-1">Create your password to continue.</p>

        <input
          className="mt-4 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none"
          placeholder="New password"
          type="password"
          value={p1}
          onChange={(e) => setP1(e.target.value)}
        />
        <input
          className="mt-3 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none"
          placeholder="Confirm password"
          type="password"
          value={p2}
          onChange={(e) => setP2(e.target.value)}
        />

        {msg && <div className="mt-3 text-sm text-red-300">{msg}</div>}

        <button
          onClick={submit}
          disabled={loading}
          className="mt-4 w-full rounded-xl bg-white text-black py-3 font-semibold disabled:opacity-40"
        >
          {loading ? "Saving…" : "Save password"}
        </button>
      </div>
    </main>
  );
}