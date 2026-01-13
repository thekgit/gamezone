"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // after login, default landing page
  const next = searchParams.get("next") || "/home";

  // ✅ If already logged in, go directly to /home (or next)
  useEffect(() => {
    (async () => {
      // ✅ This verifies the session is REALLY valid
      const { data, error } = await supabase.auth.getUser();
  
      if (!error && data?.user) {
        router.replace(next);
      }
    })();
  }, [router, next]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const canLogin = email.trim() && password.trim();

  const handleLogin = async () => {
    setMsg("");
    setLoading(true);

    try {
      // 1) Login
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        setMsg(error.message);
        return;
      }

      if (!data.session) {
        setMsg("Login succeeded but session missing.");
        return;
      }

      // 2) Read user metadata directly (NO SERVER API)
      const { data: userRes, error: uErr } = await supabase.auth.getUser();
      if (uErr) {
        setMsg(uErr.message);
        return;
      }

      const mustChange = userRes.user?.user_metadata?.must_change_password === true;

      // 3) Redirect
      if (mustChange) {
        router.replace(`/set-password?next=${encodeURIComponent(next)}`);
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
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-3xl font-bold">Login</h1>
          <p className="text-white/60 mt-2 text-sm">
            Please use your company-provided email ID for Login.
          </p>
          <p className="text-white/60 mt-2 text-sm">
            Or use the email ID you provided to your company for signup.
          </p>
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
          <a
            href="/forgot-password"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Forgot password?
          </a>
        </div>
      </div>
    </main>
  );
}