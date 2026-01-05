"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Game = {
  id: string;
  name: string;
  duration_minutes: number;
  court_count: number;
  is_active?: boolean;
};

export default function SelectPage() {
  const router = useRouter();

  const [games, setGames] = useState<Game[]>([]);
  const [gameId, setGameId] = useState<string>("");
  const [players, setPlayers] = useState<number>(1);

  const [msg, setMsg] = useState<string>("");
  const [loadingGames, setLoadingGames] = useState(false);
  const [booking, setBooking] = useState(false);

  const [slotFullOpen, setSlotFullOpen] = useState(false);

  // ✅ track latest selected gameId (prevents stale closure issue)
  const gameIdRef = useRef<string>("");
  useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);

  // ✅ track if user manually changed game (so auto-refresh won’t override)
  const userPickedGameRef = useRef(false);

  const selectedGame = useMemo(
    () => games.find((g) => g.id === gameId) || null,
    [games, gameId]
  );

  const loadGames = async () => {
    setMsg("");
    setLoadingGames(true);
    try {
      const res = await fetch("/api/games", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Failed to load games");
        return;
      }

      const list = (data.games || []) as Game[];
      const active = list.filter((g) => g.is_active !== false);

      setGames(active);

      const currentSelected = gameIdRef.current;

      // ✅ If user has NOT picked a game yet, auto-select first game
      if (!userPickedGameRef.current && !currentSelected && active.length > 0) {
        setGameId(active[0].id);
        return;
      }

      // ✅ If selected game got removed/inactive, fallback to first game
      if (currentSelected && active.length > 0 && !active.some((g) => g.id === currentSelected)) {
        userPickedGameRef.current = false; // allow auto-pick again
        setGameId(active[0].id);
      }
    } finally {
      setLoadingGames(false);
    }
  };

  useEffect(() => {
    loadGames();
    const id = setInterval(loadGames, 5000);
    return () => clearInterval(id);
  }, []);

  const bookSlot = async () => {
    setMsg("");
    setSlotFullOpen(false);

    if (!gameId) {
      setMsg("Please select a game.");
      return;
    }

    if (booking) return; // ✅ prevent double calls

    setBooking(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const jwt = sess?.session?.access_token;
      if (!jwt) {
        router.replace("/login?next=/select");
        return;
      }

      const res = await fetch("/api/sessions/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          game_id: gameId,
          players,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const err = String(data?.error || `Booking failed (${res.status})`);

        if (err.toUpperCase().includes("SLOT_FULL")) {
          setSlotFullOpen(true);
          return;
        }

        setMsg(err);
        return;
      }

      router.push("/entry");
    } finally {
      setBooking(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white px-4 flex items-center justify-center">
      {/* SLOT FULL POPUP */}
      {slotFullOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b0b0b] p-5">
            <div className="text-lg font-bold">Slot Full</div>
            <div className="text-white/70 text-sm mt-2">
              All slots for this game are currently booked. Please try another game or wait for a slot
              to free up.
            </div>
            <button
              type="button"
              onClick={() => setSlotFullOpen(false)}
              className="mt-4 w-full rounded-xl py-3 font-semibold bg-white text-black hover:bg-white/90"
            >
              OK
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-lg font-bold">Select Game</div>
        <div className="text-white/60 text-sm mt-1">Choose game & number of players.</div>

        {msg && <div className="mt-3 text-sm text-red-400">{msg}</div>}

        {/* Game dropdown */}
        <div className="mt-4">
          <label className="text-xs text-white/60">Game</label>
          <select
            className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none"
            value={gameId}
            onChange={(e) => {
              userPickedGameRef.current = true; // ✅ lock user choice
              setGameId(e.target.value);
            }}
            disabled={loadingGames || booking}
          >
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
            {games.length === 0 && <option value="">No games available</option>}
          </select>

          <div className="mt-2 text-xs text-white/50">
            {selectedGame ? (
              <>
                Duration: {selectedGame.duration_minutes} mins • Slots: {selectedGame.court_count}
              </>
            ) : loadingGames ? (
              "Loading games..."
            ) : (
              "-"
            )}
          </div>
        </div>

        {/* Players dropdown */}
        <div className="mt-4">
          <label className="text-xs text-white/60">Number of Players</label>
          <select
            className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none"
            value={players}
            onChange={(e) => setPlayers(Number(e.target.value))}
            disabled={booking}
          >
            {Array.from({ length: 10 }).map((_, i) => {
              const n = i + 1;
              return (
                <option key={n} value={n}>
                  {n} Player{n > 1 ? "s" : ""}
                </option>
              );
            })}
          </select>
        </div>

        {/* Book button */}
        <button
          type="button"
          onClick={bookSlot}
          disabled={booking || !gameId}
          className="w-full mt-5 rounded-xl py-3 font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {booking ? "Booking..." : "Book Slot"}
        </button>
      </div>
    </main>
  );
}