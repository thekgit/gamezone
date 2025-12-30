"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function VisitorQR() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-black text-white px-4 flex items-center justify-center">
      <div className="w-full max-w-sm text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="rounded-3xl border border-white/10 bg-white/5 p-6"
        >
          <h1 className="text-2xl font-bold">Entry QR</h1>
          <p className="text-white/60 mt-2 text-sm">
            Next we’ll generate a real QR and save start time.
          </p>

          <div className="mt-5 h-56 w-full rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
            <span className="text-white/50 text-sm">QR Placeholder</span>
          </div>

          <button
            onClick={() => router.push("/visitor/done")}
            className="w-full mt-5 rounded-xl py-3 font-semibold bg-white text-black"
          >
            Done
          </button>

          <button
            onClick={() => router.back()}
            className="w-full mt-3 rounded-xl py-3 font-semibold bg-white/5 border border-white/10"
          >
            Back
          </button>
        </motion.div>
      </div>
    </main>
  );
}