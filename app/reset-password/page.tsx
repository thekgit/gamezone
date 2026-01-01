"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const updatePassword = async () => {
    setMsg("");
    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMsg(error.message);
    } else {
      setMsg("Password updated successfully ✅");
      setTimeout(() => router.push("/login"), 1500);
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold">Reset Password</h1>
        <p className="text-white/60 text-sm mt-1">
          Enter your new password.
        </p>

        <input
          className="mt-5 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none"
          placeholder="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {msg && <div className="mt-3 text-sm text-green-400">{msg}</div>}

        <button
          onClick={updatePassword}
          disabled={!password || loading}
          className="w-full mt-5 rounded-xl py-3 font-semibold bg-white text-black disabled:opacity-40"
        >
          {loading ? "Updating..." : "Update password"}
        </button>
      </div>
    </main>
  );
}