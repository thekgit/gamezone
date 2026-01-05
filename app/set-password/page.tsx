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

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const onSave = async () => {
    setMsg("");

    if (pw1.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }
    if (pw1 !== pw2) {
      setMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      // must be logged in already
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) {
        router.replace("/login");
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: pw1,
        data: { must_change_password: false }, // ✅ clear flag
      });

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
    <main className="min-h-screen bg-black text-white px-4 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold">Create New Password</h1>
        <p className="text-white/60 text-sm mt-1">
          This is required on your first login.
        </p>

        <div className="mt-5 space-y-3">
          <input
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="New password"
            type="password"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
          />
          <input
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="Confirm new password"
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
          />
        </div>

        {msg && <div className="mt-3 text-sm text-red-300">{msg}</div>}

        <button
          onClick={onSave}
          disabled={loading}
          className="w-full mt-5 rounded-xl py-3 font-semibold bg-white text-black disabled:opacity-40"
        >
          {loading ? "Saving..." : "Save Password"}
        </button>
      </div>
    </main>
  );
}