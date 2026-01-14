"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
type PlayerHit = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  employee_id: string | null;
};
type Game = {
  id: string;
  name: string;
  duration_minutes: number;
  court_count: number;
  is_active?: boolean;
};
type PersonPick = {
  user_id: string;
  full_name: string;
  email: string;
  employee_id: string;
  phone?: string;
};
export default function SelectPage() {
  const router = useRouter();
  
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PersonPick[]>([]);
  const [picked, setPicked] = useState<PersonPick[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [gameId, setGameId] = useState<string>("");
  const [players, setPlayers] = useState<number>(1);
  const searchPeople = async (text: string) => {
    setQ(text);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
  
    setSearching(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const jwt = sess?.session?.access_token;
      if (!jwt) {
        router.replace("/login?next=/select");
        return;
      }
  
      const res = await fetch(`/api/players/search?q=${encodeURIComponent(text.trim())}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${jwt}` },
      });
  
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResults([]);
        return;
      }
  
      const list = (data.users || []) as PersonPick[];
  
      // remove already picked
      const pickedIds = new Set(picked.map((p) => p.user_id));
      setResults(list.filter((p) => !pickedIds.has(p.user_id)));
    } finally {
      setSearching(false);
    }
  };
  const [msg, setMsg] = useState<string>("");
  const [loadingGames, setLoadingGames] = useState(false);
  const [booking, setBooking] = useState(false);

  const [slotFullOpen, setSlotFullOpen] = useState(false);

  const gameIdRef = useRef<string>("");
  useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);

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

      if (!userPickedGameRef.current && !currentSelected && active.length > 0) {
        setGameId(active[0].id);
        return;
      }

      if (currentSelected && active.length > 0 && !active.some((g) => g.id === currentSelected)) {
        userPickedGameRef.current = false;
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
  useEffect(() => {
    const id = setTimeout(async () => {
      const term = q.trim();
      if (term.length < 2) {
        setHits([]);
        return;
      }

      setSearching(true);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const jwt = sess?.session?.access_token;
        if (!jwt) {
          setHits([]);
          return;
        }

        const res = await fetch(`/api/players/search?q=${encodeURIComponent(term)}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${jwt}` },
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setHits([]);
          return;
        }

        const list = Array.isArray(data.users) ? (data.users as PlayerHit[]) : [];
        // remove already added
        setHits(list.filter((u) => !selectedIds.includes(u.user_id)));
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(id);
  }, [q, selectedIds]);
  const bookSlot = async () => {
    setMsg("");
    setSlotFullOpen(false);

    if (!gameId || booking) return;

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
          player_user_ids: selectedIds, // ✅ add this
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
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b0b0b] p-5 text-center">
            <div className="text-lg font-bold">Slot Full</div>
            <div className="text-white/70 text-sm mt-2">
              All slots for this game are currently booked.  
              Please try another game or wait for a slot to free up.
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

      {/* MAIN CARD */}
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <div className="text-lg font-bold">Select Game</div>
        <div className="text-white/60 text-sm mt-1">
          Choose game & number of players.
        </div>

        {msg && <div className="mt-3 text-sm text-red-400">{msg}</div>}

        {/* Game dropdown */}
        <div className="mt-4">
          <label className="text-xs text-white/60">Game</label>
          <select
            className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none text-center"
            value={gameId}
            onChange={(e) => {
              userPickedGameRef.current = true;
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
                Duration: {selectedGame.duration_minutes} mins • Slots:{" "}
                {selectedGame.court_count}
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
            className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none text-center"
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
        {/* Add other players */}
        {/* Add other players */}
        
                 {/* Add other players */}
        <div className="mt-4">
          <label className="text-xs text-white/60">Add other players</label>

          <input
            className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none"
            placeholder="Search by name, email, employee id..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            disabled={booking}
          />

          {/* Selected pills */}
          {selectedIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedIds((prev) => prev.filter((x) => x !== id))}
                  className="text-xs rounded-full border border-white/10 bg-white/5 px-3 py-1 hover:bg-white/10"
                  title="Remove"
                >
                  Added • {id.slice(0, 6)}… ✕
                </button>
              ))}
            </div>
          )}

          {/* Results */}
          <div className="mt-2 rounded-xl border border-white/10 bg-black/30 overflow-hidden">
            {searching ? (
              <div className="px-4 py-3 text-sm text-white/60">Searching...</div>
            ) : hits.length === 0 ? (
              <div className="px-4 py-3 text-sm text-white/60">No matches.</div>
            ) : (
              hits.map((u) => (
                <div
                  key={u.user_id}
                  className="flex items-center justify-between gap-3 px-4 py-3 border-t border-white/10 first:border-t-0"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {u.full_name || u.employee_id || u.email || "User"}
                    </div>
                    <div className="text-xs text-white/60 truncate">
                      {u.employee_id ? `${u.employee_id} • ` : ""}
                      {u.email || "-"}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedIds((prev) =>
                        prev.includes(u.user_id) ? prev : [...prev, u.user_id]
                      );
                      setQ("");       // optional: clear search
                      setHits([]);    // optional: close list
                    }}
                    className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15"
                  >
                    + Add
                  </button>
                </div>
              ))
            )}
          </div>
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