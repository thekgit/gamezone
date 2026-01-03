"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Game = {
  id: string;
  name: string;
  court_count: number;
  duration_minutes: number;
  price_rupees?: number;
  is_active?: boolean;
};

export default function BookingPage() {
  const router = useRouter();

  const [games, setGames] = useState<Game[]>([]);
  const [gameId, setGameId] = useState<string>("");
  const [players, setPlayers] = useState<number>(1);

  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const loadGames = async () => {
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/games", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Failed to load games");
        return;
      }

      const list: Game[] = (data?.games || []).filter((g: Game) => g.is_active !== false);
      setGames(list);

      // auto select first game
      if (!gameId && list.length > 0) setGameId(list[0].id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedGame = useMemo(
    () => games.find((g) => g.id === gameId) || null,
    [games, gameId]
  );

  const bookSlot = async () => {
    setMsg("");
    setLoading(true);
    try {
      // Must be logged in
      const { data: sess } = await supabase.auth.getSession();
      const jwt = sess?.session?.access_token;
      if (!jwt) {
        router.replace("/login?next=/booking");
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
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          game_id: gameId,       // ✅ NEW format your create route supports
          players: Number(players || 1),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg(data?.error || `Booking failed (${res.status})`);
        return;
      }

      // ✅ success page
      router.push("/entry");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white px-4 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold">Select Game</h1>
        <p className="text-white/60 text-sm mt-1">Choose game & number of players.</p>

        {msg && <div className="mt-4 text-sm text-red-400">{msg}</div>}

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs text-white/60">Game</label>
            <select
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
              disabled={loading}
            >
              {games.length === 0 ? (
                <option value="">No games available</option>
              ) : (
                games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))
              )}
            </select>

            {selectedGame && (
              <div className="mt-2 text-xs text-white/50">
                Duration: {selectedGame.duration_minutes} mins • Slots: {selectedGame.court_count}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-white/60">Number of Players</label>
            <input
              type="number"
              min={1}
              max={20}
              value={players}
              onChange={(e) => setPlayers(Number(e.target.value))}
              className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
              disabled={loading}
            />
          </div>

          <button
            onClick={bookSlot}
            disabled={loading || !gameId}
            className="w-full rounded-xl py-3 font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40"
          >
            {loading ? "Booking..." : "Book Slot"}
          </button>

          <button
            onClick={loadGames}
            disabled={loading}
            className="w-full rounded-xl py-3 font-semibold bg-white/10 hover:bg-white/15 disabled:opacity-40"
          >
            Reload Games
          </button>
        </div>
      </div>
    </main>
  );
}