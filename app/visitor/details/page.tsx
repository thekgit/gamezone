"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function VisitorDetails() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const canContinue =
    name.trim().length > 0 &&
    phone.trim().length > 0 &&
    email.trim().length > 0;

  const handleNext = async () => {
    setErrorMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/visitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMsg(data?.error || "Failed to save visitor details");
        setLoading(false);
        return;
      }

      console.log("Visitor saved:", data.customer);

      router.push("/visitor/games");
    } catch (err) {
      console.error(err);
      setErrorMsg("Network or server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white px-4 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-bold">Visitor Details</h1>
          <p className="text-white/60 mt-2 text-sm">
            Enter your details to continue.
          </p>
        </motion.div>

        <div className="space-y-3">
          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="Phone number"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="Email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {errorMsg && (
          <div className="mt-3 text-sm text-red-400">
            {errorMsg}
          </div>
        )}

        <button
          disabled={!canContinue || loading}
          onClick={handleNext}
          className="w-full mt-5 rounded-xl py-3 font-semibold bg-white text-black disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : "Next"}
        </button>

        <button
          onClick={() => router.back()}
          className="w-full mt-3 rounded-xl py-3 font-semibold bg-white/5 border border-white/10"
        >
          Back
        </button>
      </div>
    </main>
  );
}