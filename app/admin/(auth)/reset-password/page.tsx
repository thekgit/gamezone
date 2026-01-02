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

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const updatePassword = async () => {
    setMsg(null);

    if (pw.length < 6) return setMsg("Password must be at least 6 characters.");
    if (pw !== pw2) return setMsg("Passwords do not match.");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);

    if (error) return setMsg(error.message);

    setMsg("✅ Password updated. Redirecting to login...");
    setTimeout(() => router.push("/admin/login"), 1200);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0b0b] text-white p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold">Reset Password</h1>
        <p className="text-sm text-white/60 mt-1">
          Enter your new password.
        </p>

        <div className="mt-5 space-y-3">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="New password"
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
          />

          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="Confirm new password"
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
          />

          <button
            onClick={updatePassword}
            disabled={loading}
            className="w-full rounded-xl py-3 font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40"
          >
            {loading ? "Updating..." : "Update password"}
          </button>

          {msg && <div className="text-sm text-white/80">{msg}</div>}
        </div>
      </div>
    </div>
  );
}