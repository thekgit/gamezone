"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const GAMES = [
  { id: "ps5-fifa", name: "PS5 • FIFA", minutes: 30, price: 80 },
  { id: "ps5-gta", name: "PS5 • GTA V", minutes: 30, price: 80 },
  { id: "pc-valorant", name: "PC • Valorant", minutes: 60, price: 120 },
  { id: "vr", name: "VR Experience", minutes: 15, price: 100 },
  { id: "carrom", name: "Carrom", minutes: 30, price: 40 },
  { id: "pool", name: "Pool", minutes: 30, price: 60 },
];

export default function VisitorGames() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const selectedGame = useMemo(
    () => GAMES.find((g) => g.id === selected),
    [selected]
  );

  return (
    <main className="min-h-screen bg-black text-white px-4 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          className="mb-5"
        >
          <h1 className="text-2xl font-bold">Choose your game</h1>
          <p className="text-white/60 mt-2 text-sm">
            Tap one option to continue.
          </p>
        </motion.div>

        <div className="space-y-3">
          {GAMES.map((g, i) => {
            const active = g.id === selected;
            return (
              <motion.button
                key={g.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.22 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelected(g.id)}
                className={[
                  "w-full text-left rounded-2xl border px-4 py-4",
                  "bg-white/5 border-white/10",
                  active ? "border-white/40 bg-white/10" : "active:bg-white/10",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">{g.name}</div>
                    <div className="text-xs text-white/60 mt-1">
                      {g.minutes} min • ₹{g.price}
                    </div>
                  </div>

                  <div
                    className={[
                      "h-5 w-5 rounded-full border",
                      active ? "bg-white border-white" : "border-white/30",
                    ].join(" ")}
                  />
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Summary card */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          {selectedGame ? (
            <div className="text-sm">
              <div className="text-white/70">Selected</div>
              <div className="font-semibold mt-1">{selectedGame.name}</div>
              <div className="text-white/60 mt-1">
                {selectedGame.minutes} min • ₹{selectedGame.price}
              </div>
            </div>
          ) : (
            <div className="text-sm text-white/60">
              Select a game to enable Next.
            </div>
          )}
        </div>

        <button
          disabled={!selected}
          onClick={() => router.push("/visitor/qr")}
          className="w-full mt-4 rounded-xl py-3 font-semibold bg-white text-black disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next
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