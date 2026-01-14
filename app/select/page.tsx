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

  // ---------------- CORE STATE ----------------
  const [games, setGames] = useState<Game[]>([]);
  const [gameId, setGameId] = useState("");
  const [players, setPlayers] = useState(1);

  const [msg, setMsg] = useState("");
  const [loadingGames, setLoadingGames] = useState(false);
  const [booking, setBooking] = useState(false);

  const [slotFullOpen, setSlotFullOpen] = useState(false);

  // ---------------- SEARCH STATE ----------------
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ProfilePick[]>([]);
  const [picked, setPicked] = useState<ProfilePick[]>([]);

  // ---------------- REFS ----------------
  const gameIdRef = useRef("");
  const userPickedGameRef = useRef(false);

  useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);

  const selectedGame = useMemo(
    () => games.find((g) => g.id === gameId) || null,
    [games, gameId]
  );

  // ---------------- LOAD GAMES ----------------
  const loadGames = async () => {
    setLoadingGames(true);
    try {
      const res = await fetch("/api/games", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        setMsg(data?.error || "Failed to load games");
        return;
      }

      const active = (data.games || []).filter((g: Game) => g.is_active !== false);
      setGames(active);

      const currentSelected = gameIdRef.current;

      if (!userPickedGameRef.current && !currentSelected && active.length > 0) {
        setGameId(active[0].id);
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

  // ---------------- SEARCH (ONLY ONE EFFECT) ----------------
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
          setMsg("Session expired. Please login again.");
          setResults([]);
          return;
        }

        const res = await fetch(
          `/api/profiles/search?q=${encodeURIComponent(term)}`,
          {
            cache: "no-store",
            headers: { Authorization: `Bearer ${jwt}` },
          }
        );

        const data = await res.json();

        if (!res.ok) {
          setMsg(data?.error || `Search failed (HTTP ${res.status})`);
          setResults([]);
          return;
        }

        setResults(data.profiles || []);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [q]);

  // ---------------- PICK HANDLERS ----------------
  const addPick = (p: ProfilePick) => {
    setPicked((prev) =>
      prev.some((x) => x.user_id === p.user_id) ? prev : [...prev, p]
    );
  };

  const removePick = (uid: string) => {
    setPicked((prev) => prev.filter((x) => x.user_id !== uid));
  };

  // ---------------- BOOK SLOT ----------------
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

      const data = await res.json();

      if (!res.ok) {
        const err = String(data?.error || res.status);
        if (err.includes("SLOT_FULL")) {
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

  // ---------------- UI ----------------
  return (
    <main className="min-h-screen bg-black text-white px-4 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <div className="text-lg font-bold">Select Game</div>
        <div className="text-white/60 text-sm mt-1">
          Choose game & number of players.
        </div>

        {msg && <div className="mt-3 text-sm text-red-400">{msg}</div>}

        {/* Add other players */}
        <div className="mt-5">
          <div className="text-sm font-semibold">Add other players</div>

          <input
            className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-center"
            placeholder="Search by name, email, employee id"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          {searching && (
            <div className="mt-2 text-xs text-white/50">Searching…</div>
          )}

          {results.map((r) => (
            <div
              key={r.user_id}
              className="mt-2 flex justify-between items-center border border-white/10 rounded-xl px-3 py-2"
            >
              <div className="text-left">
                <div className="font-semibold">{r.full_name}</div>
                <div className="text-xs text-white/60">
                  {r.employee_id} • {r.email}
                </div>
              </div>
              <button
                onClick={() => addPick(r)}
                className="px-3 py-1 rounded bg-white/10"
              >
                + Add
              </button>
            </div>
          ))}

          {picked.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-white/60">Selected players</div>
              {picked.map((p) => (
                <div key={p.user_id} className="mt-2 text-sm">
                  {p.full_name}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={bookSlot}
          disabled={booking}
          className="w-full mt-6 rounded-xl py-3 bg-blue-600 font-semibold"
        >
          {booking ? "Booking…" : "Book Slot"}
        </button>
      </div>
    </main>
  );
}