"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Game = {
  id: string;
  name: string;
  duration_minutes: number;
  court_count: number; // slots
  is_active: boolean;
};

function minsLabel(mins: number) {
  if (!mins || mins <= 0) return "-";
  if (mins % 60 === 0) return `${mins / 60} hour`;
  return `${mins} mins`;
}

export default function SelectPage() {
  const router = useRouter();

  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>("");
  const [players, setPlayers] = useState<number>(1);

  const [loadingGames, setLoadingGames] = useState(false);
  const [booking, setBooking] = useState(false);

  const [modal, setModal] = useState<{ title: string; message: string } | null>(null);

  const activeGames = useMemo(
    () => (games || []).filter((g) => g.is_active !== false),
    [games]
  );

  const selectedGame = useMemo(
    () => activeGames.find((g) => g.id === selectedGameId) || null,
    [activeGames, selectedGameId]
  );

  const loadGames = async () => {
    setLoadingGames(true);
    try {
      // If your public games endpoint is different, change here:
      const res = await fetch("/api/games", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setModal({
          title: "Error",
          message: data?.error || "Failed to load games",
        });
        return;
      }

      const list: Game[] = (data?.games || []) as Game[];
      setGames(list);

      // auto select first game if none selected
      if (!selectedGameId && list.length > 0) {
        const firstActive = list.find((g) => g.is_active !== false);
        if (firstActive) setSelectedGameId(firstActive.id);
      }
    } finally {
      setLoadingGames(false);
    }
  };

  // ✅ auto refresh games so admin changes reflect automatically
  useEffect(() => {
    loadGames();
    const id = setInterval(loadGames, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onBook = async () => {
    if (!selectedGameId) {
      setModal({ title: "Select Game", message: "Please select a game first." });
      return;
    }

    if (booking) return;
    setBooking(true);

    try {
      // ✅ attach user token if available (prevents other users ending/creating sessions wrongly)
      const { data: sess } = await supabase.auth.getSession();
      const jwt = sess?.session?.access_token;

      const res = await fetch("/api/sessions/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        body: JSON.stringify({
          game_id: selectedGameId,
          players,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const err = String(data?.error || "").toUpperCase();

        if (err === "SLOT_FULL" || data?.code === "SLOT_FULL") {
          setModal({
            title: "Slot Full",
            message: "Slot full. Please try another game or wait for a slot to free up.",
          });
          return;
        }

        setModal({
          title: "Booking Failed",
          message: data?.error || `Booking failed (${res.status})`,
        });
        return;
      }

      // ✅ success → go to entry page (your existing flow)
      router.push("/entry");
    } catch {
      setModal({ title: "Network Error", message: "Please try again." });
    } finally {
      // ✅ ALWAYS reset booking state so button never gets stuck
      setBooking(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white px-4 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-lg font-bold">Select Game</div>
        <div className="text-white/60 text-sm mt-1">Choose game & number of players.</div>

        {/* Game dropdown */}
        <div className="mt-5">
          <label className="text-xs text-white/60">Game</label>

          <select
            className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            value={selectedGameId}
            onChange={(e) => setSelectedGameId(e.target.value)}
            disabled={loadingGames}
          >
            {activeGames.length === 0 ? (
              <option value="">No games available</option>
            ) : (
              activeGames.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))
            )}
          </select>

          <div className="mt-2 text-xs text-white/50">
            {selectedGame ? (
              <>
                Duration: {minsLabel(selectedGame.duration_minutes)} • Slots: {selectedGame.court_count}
              </>
            ) : (
              <>Loading game info…</>
            )}
          </div>
        </div>

        {/* Players dropdown */}
        <div className="mt-4">
          <label className="text-xs text-white/60">Number of Players</label>
          <select
            className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            value={players}
            onChange={(e) => setPlayers(Number(e.target.value))}
          >
            {Array.from({ length: 10 }).map((_, i) => {
              const val = i + 1;
              return (
                <option key={val} value={val}>
                  {val} Player{val > 1 ? "s" : ""}
                </option>
              );
            })}
          </select>
        </div>

        {/* Book button */}
        <button
          onClick={onBook}
          disabled={booking || !selectedGameId}
          className="w-full mt-5 rounded-xl py-3 font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {booking ? "Booking..." : "Book Slot"}
        </button>
      </div>

      {/* ✅ Modal popup (Slot Full / Error) */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b0b0b] p-5">
            <div className="text-lg font-semibold">{modal.title}</div>
            <div className="mt-2 text-sm text-white/70">{modal.message}</div>

            <button
              onClick={() => setModal(null)}
              className="mt-4 w-full rounded-xl py-3 font-semibold bg-white text-black hover:bg-white/90"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </main>
  );
}