"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

type GameKey = "pickleball" | "tabletennis";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GAME_LABEL: Record<GameKey, string> = {
  pickleball: "Pickle Ball",
  tabletennis: "Table Tennis",
};

export default function SelectPage() {
  const router = useRouter();
  const [game, setGame] = useState<GameKey>("pickleball");
  const [players, setPlayers] = useState<number>(2);

  const [msg, setMsg] = useState("");
  const [booking, setBooking] = useState(false);

  const playerOptions = useMemo(() => {
    return game === "pickleball" ? [1, 2, 3, 4] : [1, 2];
  }, [game]);

  const onNext = async () => {
    setMsg("");
    setBooking(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setMsg("Not logged in. Please login again.");
        return;
      }

      const res = await fetch("/api/sessions/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ game, players }),
      });

      const out = await res.json().catch(() => ({}));

      if (!res.ok) {
        // show user-friendly message
        setMsg(out?.error === "SLOT_FULL" ? "Slot Cannot Be Booked" : (out?.error || "Booking failed"));
        return;
      }

      // show success page (simple)
      router.push(`/entry?session_id=${encodeURIComponent(out.session_id)}`);
    } finally {
      setBooking(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white px-4 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-3xl font-bold">Select Game</h1>
          <p className="text-white/60 mt-2 text-sm">Choose game & number of players.</p>
        </motion.div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
          <div>
            <label className="text-xs text-white/60">Game</label>
            <select
              value={game}
              onChange={(e) => setGame(e.target.value as GameKey)}
              className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            >
              <option value="pickleball">{GAME_LABEL.pickleball}</option>
              <option value="tabletennis">{GAME_LABEL.tabletennis}</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-white/60">Number of Players</label>
            <select
              value={players}
              onChange={(e) => setPlayers(Number(e.target.value))}
              className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            >
              {playerOptions.map((p) => (
                <option key={p} value={p}>
                  {p} {p === 1 ? "Player" : "Players"}
                </option>
              ))}
            </select>
          </div>

          {msg && <div className="text-sm text-red-300">{msg}</div>}

          <button
            onClick={onNext}
            disabled={booking}
            className="w-full rounded-xl py-3 font-semibold bg-white text-black disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {booking ? "Creating slot..." : "Next"}
          </button>
        </div>

        <div className="mt-4 text-center text-xs text-white/40">
          Auto slot system enabled (Pickle Ball cap: 3 • Table Tennis cap: 2)
        </div>
      </div>
    </main>
  );
}