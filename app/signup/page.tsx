"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { redirect } from "next/navigation";

export default function SignupPage() {
  redirect("/login");
}
{/*
export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = fullName.trim() && phone.trim() && email.trim();

  const handleSendLink = async () => {
    setMsg("");

    // ✅ phone validation (exactly 10 digits)
    if (!/^\d{10}$/.test(phone)) {
      setMsg("Phone number must be exactly 10 digits.");
      return;
    }

    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: cleanEmail,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg(data?.error || "Failed to send email link");
        return;
      }

      // Save profile info until user clicks the email link
      localStorage.setItem(
        "pending_profile",
        JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: cleanEmail,
        })
      );

      setMsg("Email link sent. Open the link in your email to continue.");
      router.push(`/check-email?email=${encodeURIComponent(cleanEmail)}`);
    } catch {
      setMsg("Network/server error");
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
          <h1 className="text-3xl font-bold">Create account</h1>
          <p className="text-white/60 mt-2 text-sm">
            We’ll send you a one-time email link. Open it to set your password.
          </p>
        </motion.div>

        <div className="space-y-3">
          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <input
            placeholder="Phone (10 digits)"
            inputMode="numeric"
            maxLength={10}
            value={phone}
            onChange={(e) => {
              // ✅ keep digits only
              const val = e.target.value.replace(/\D/g, "");
              setPhone(val);
            }}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
          />

          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="Email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {msg && <div className="mt-3 text-sm text-white/80">{msg}</div>}

        <button
          disabled={!canSubmit || loading}
          onClick={handleSendLink}
          className="w-full mt-5 rounded-xl py-3 font-semibold bg-white text-black disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Sending..." : "Send Email Link"}
        </button>

        <div className="mt-4 text-sm text-white/60">
          Already have an account?{" "}
          <Link className="text-white underline" href="/login">
            Login
          </Link>
        </div>
      </div>
    </main>
  );
}
  */}