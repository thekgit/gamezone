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

type ProfilePick = {
  user_id: string;
  full_name: string;
  email: string;
  employee_id: string;
  phone?: string;
};

export default function SelectPage() {
  const router = useRouter();

  const [games, setGames] = useState<Game[]>([]);
  const [gameId, setGameId] = useState("");
  const [players, setPlayers] = useState(1);

  const [msg, setMsg] = useState("");
  const [loadingGames, setLoadingGames] = useState(false);
  const [booking, setBooking] = useState(false);
  const [slotFullOpen, setSlotFullOpen] = useState(false);

  /* ---------------- refs ---------------- */
  const userPickedGameRef = useRef(false);
  const gameIdRef = useRef("");

  useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);

  /* ---------------- derived ---------------- */
  const selectedGame = useMemo(
    () => games.find((g) => g.id === gameId) || null,
    [games, gameId]
  );

  /* ---------------- load games ---------------- */
  const loadGames = async () => {
    setLoadingGames(true);
    try {
      const res = await fetch("/api/games", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Failed to load games");
        return;
      }

      const active = (data.games || []).filter((g: Game) => g.is_active !== false);
      setGames(active);

      const currentSelected = gameIdRef.current;

      if (!userPickedGameRef.current && !currentSelected && active.length > 0) {
        setGameId(active[0].id);
        return;
      }

      if (
        currentSelected &&
        active.length > 0 &&
        !active.some((g: Game) => g.id === currentSelected)
      ) {
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

  /* ---------------- search players ---------------- */
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ProfilePick[]>([]);
  const [picked, setPicked] = useState<ProfilePick[]>([]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const jwt = sess?.session?.access_token;

        if (!jwt) {
          setMsg("Not logged in");
          setResults([]);
          return;
        }

        const res = await fetch(`/api/profiles/search?q=${encodeURIComponent(term)}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${jwt}` },
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMsg(data?.error || "Search failed");
          setResults([]);
          return;
        }

        setResults((data.profiles || []) as ProfilePick[]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [q]);

  /* ---------------- helpers ---------------- */
  const addPick = (p: ProfilePick) => {
    setPicked((prev) =>
      prev.some((x) => x.user_id === p.user_id) ? prev : [...prev, p]
    );
  };

  const removePick = (id: string) => {
    setPicked((prev) => prev.filter((x) => x.user_id !== id));
  };

  /* ---------------- book slot ---------------- */
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
          player_user_ids: picked.map((p) => p.user_id),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (String(data?.error).includes("SLOT_FULL")) {
          setSlotFullOpen(true);
          return;
        }
        setMsg(data?.error || "Booking failed");
        return;
      }

      router.push("/entry");
    } finally {
      setBooking(false);
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <main className="min-h-screen bg-black text-white px-4 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <h1 className="text-lg font-bold">Select Game</h1>
        <p className="text-white/60 text-sm mt-1">Choose game & players</p>

        {msg && <div className="mt-3 text-sm text-red-400">{msg}</div>}

        {/* Game */}
        <select
          className="mt-4 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-center"
          value={gameId}
          onChange={(e) => {
            userPickedGameRef.current = true;
            setGameId(e.target.value);
          }}
        >
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        {/* Players */}
        <select
          className="mt-4 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-center"
          value={players}
          onChange={(e) => setPlayers(Number(e.target.value))}
        >
          {Array.from({ length: 10 }).map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1} Player{i > 0 ? "s" : ""}
            </option>
          ))}
        </select>

        {/* Search */}
        <input
          className="mt-4 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-center"
          placeholder="Search players"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {searching && <div className="text-xs mt-2">Searching…</div>}

        {results.map((r) => (
          <div key={r.user_id} className="mt-2 flex justify-between items-center bg-black/30 p-2 rounded">
            <div className="text-left text-sm">
              <div className="font-semibold">{r.full_name}</div>
              <div className="text-xs text-white/60">{r.email}</div>
            </div>
            <button onClick={() => addPick(r)} className="text-sm bg-white/10 px-3 py-1 rounded">
              + Add
            </button>
          </div>
        ))}

        <button
          onClick={bookSlot}
          disabled={booking}
          className="mt-5 w-full rounded-xl py-3 bg-blue-600 font-semibold"
        >
          {booking ? "Booking..." : "Book Slot"}
        </button>
      </div>
    </main>
  );
}