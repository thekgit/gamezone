"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function Done() {
  return (
    <main className="min-h-screen bg-black text-white px-4 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6 text-center"
      >
        <div className="text-4xl">✅</div>
        <h1 className="text-2xl font-bold mt-3">Entry Created</h1>
        <p className="text-white/60 mt-2 text-sm">
          Next we’ll connect database + real QR + admin panel.
        </p>

        <Link
          href="/"
          className="block w-full mt-5 rounded-xl py-3 font-semibold bg-white text-black"
        >
          Back to Home
        </Link>
      </motion.div>
    </main>
  );
}