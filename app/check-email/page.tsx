"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Inner() {
  const params = useSearchParams();
  const email = params.get("email") || "";

  return (
    <main className="min-h-screen bg-black text-white px-4 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold">Confirm your email</h1>
          <p className="text-white/60 mt-2 text-sm">
            We sent a one-time confirmation link to:
          </p>
          <p className="mt-2 text-white font-semibold break-all">{email || "your email"}</p>

          <div className="mt-4 text-sm text-white/60 space-y-2">
            <p>✅ Open your email and click the link.</p>
            <p>📩 Check Spam/Promotions if you don’t see it.</p>
          </div>

          <div className="mt-5 text-sm text-white/60">
            Already confirmed?{" "}
            <Link href="/login" className="text-white underline">
              Go to login
            </Link>
          </div>
        </motion.div>
      </div>
    </main>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}