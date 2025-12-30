"use client";

import { motion } from "framer-motion";

export default function EntryPage() {
  return (
    <main className="min-h-screen bg-black text-white px-4 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <div className="text-2xl font-bold">✅ Slot has been created successfully</div>
        <div className="text-white/60 mt-2 text-sm">
          Please wait. Manager will handle entry/exit from Admin panel.
        </div>
      </div>
    </main>
  );
}