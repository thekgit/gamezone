"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ✅ after login we want Active Sessions page (NOT /select)
  const next = searchParams.get("next") || "/home";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const canLogin = email.trim() && password.trim();

  const handleLogin = async () => {
    setMsg("");
    setLoading(true);
  
    try {
      const cleanEmail = email.trim().toLowerCase();
  
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
  
      if (error) {
        setMsg(error.message);
        return;
      }
  
      // ✅ Check if user MUST change password (only for NEW12345 users)
      const mustChange = !!data?.user?.user_metadata?.must_change_password;
  
      if (mustChange) {
        router.replace(`/set-password?next=${encodeURIComponent("/home")}`);
        return;
      }
  
      // ✅ Normal users -> go to /home (Active sessions page)
      router.replace(next || "/home");
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
          <h1 className="text-3xl font-bold">Login</h1>
          <p className="text-white/60 mt-2 text-sm">Use your email + password.</p>
        </motion.div>

        <div className="space-y-3">
          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="Email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {msg && <div className="mt-3 text-sm text-red-400">{msg}</div>}

        <button
          disabled={!canLogin || loading}
          onClick={handleLogin}
          className="w-full mt-5 rounded-xl py-3 font-semibold bg-white text-black disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <div className="mt-2 flex justify-end">
          <a href="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300">
            Forgot password?
          </a>
        </div>

        <div className="mt-4 text-sm text-white/60">
          New here?{" "}
          <Link className="text-white underline" href="/signup">
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}