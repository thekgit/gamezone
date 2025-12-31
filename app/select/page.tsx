"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type DbGame = {
  id: string;
  name: string;
  duration_minutes: number;
  court_count: number;
  price: number;
};

export default function SelectPage() {
  const router = useRouter();

  const [games, setGames] = useState<DbGame[]>([]);
  const [gameId, setGameId] = useState<string>("");
  const [players, setPlayers] = useState<number>(2);

  const [msg, setMsg] = useState("");
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/games", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Failed to load games");
        return;
      }
      const list: DbGame[] = data.games || [];
      setGames(list);
      if (!gameId && list.length) setGameId(list[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playerOptions = useMemo(() => [1, 2, 3, 4], []);

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

      if (!gameId) {
        setMsg("Please select a game.");
        return;
      }

      const res = await fetch("/api/sessions/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ game_id: gameId, players }),
      });

      const raw = await res.text();
      let out: any = {};
      try {
        out = JSON.parse(raw);
      } catch {}

      if (!res.ok) {
        if (out?.error === "SLOT_FULL") setMsg("Slot Cannot Be Booked");
        else setMsg(out?.error || `Booking failed (${res.status})`);
        return;
      }

      router.push(`/entry?session_id=${encodeURIComponent(out.session_id)}`);
    } catch {
      setMsg("Network or server error");
    } finally {
      setBooking(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white px-4 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-3xl font-bold">Select Game</h1>
          <p className="text-white/60 mt-2 text-sm">
            Choose game & number of players.
          </p>
        </motion.div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
          <div>
            <label className="text-xs text-white/60">Game</label>
            <select
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
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
      </div>
    </main>
  );
}