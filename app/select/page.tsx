"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// --- Types ---
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

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function uniqStrings(arr: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const a of arr) {
    const s = safeStr(a);
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function clampInt(n: any, min: number, max: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.floor(x)));
}

export default function SelectPage() {
  const router = useRouter();

  // --- Games state ---
  const [games, setGames] = useState<Game[]>([]);
  const [gameId, setGameId] = useState<string>("");
  const [loadingGames, setLoadingGames] = useState(false);

  // --- Booking / UI state ---
  const [msg, setMsg] = useState<string>("");
  const [booking, setBooking] = useState(false);
  const [slotFullOpen, setSlotFullOpen] = useState(false);

  // --- Player add system state ---
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // ✅ Track latest selected game id to avoid stale closures
  const gameIdRef = useRef<string>("");
  useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);

  // ✅ Track if user manually picked game (so refresh doesn't override)
  const userPickedGameRef = useRef(false);

  // ✅ Derived selected game
  const selectedGame = useMemo(() => {
    return games.find((g) => g.id === gameId) || null;
  }, [games, gameId]);

  // ✅ Players count is now automatic:
  // you (1) + added others (selectedIds length)
  const computedPlayers = useMemo(() => {
    const others = Array.isArray(selectedIds) ? selectedIds.length : 0;
    return clampInt(1 + others, 1, 10); // keep max 10 like before
  }, [selectedIds]);

  // --- Load games ---
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

      // ✅ Auto select first if user did not pick yet
      if (!userPickedGameRef.current && !currentSelected && active.length > 0) {
        setGameId(active[0].id);
        return;
      }

      // ✅ If selected game removed/inactive, fallback
      if (currentSelected && active.length > 0 && !active.some((g) => g.id === currentSelected)) {
        userPickedGameRef.current = false;
        setGameId(active[0].id);
      }
    } catch (e: any) {
      setMsg(e?.message || "Failed to load games");
    } finally {
      setLoadingGames(false);
    }
  };

  useEffect(() => {
    loadGames();
    const id = setInterval(loadGames, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Search players (debounced) ---
  useEffect(() => {
    const timer = setTimeout(async () => {
      const term = safeStr(q);
      if (term.length < 2) {
        setHits([]);
        return;
      }

      setSearching(true);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const jwt = sess?.session?.access_token;

        if (!jwt) {
          // not logged in -> ignore silently, booking will redirect anyway
          setHits([]);
          return;
        }

        const res = await fetch(`/api/players?q=${encodeURIComponent(term)}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${jwt}` },
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setHits([]);
          return;
        }

        const list = Array.isArray(data.users) ? (data.users as PlayerHit[]) : [];

        // ✅ exclude already selected ids
        const sel = new Set(selectedIds);
        const filtered = list.filter((u) => u?.user_id && !sel.has(u.user_id));

        setHits(filtered);
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [q, selectedIds]);

  // --- Add/remove helper actions ---
  const addPlayer = (u: PlayerHit) => {
    const uid = safeStr(u?.user_id);
    if (!uid) return;

    setSelectedIds((prev) => {
      const merged = uniqStrings([...prev, uid]);
      // enforce max players 10 -> max other players = 9
      const maxOther = 9;
      return merged.slice(0, maxOther);
    });

    // Optional: clear search and close dropdown
    setQ("");
    setHits([]);
  };

  const removePlayerById = (uid: string) => {
    const id = safeStr(uid);
    if (!id) return;
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const clearAllPlayers = () => {
    setSelectedIds([]);
    setHits([]);
    setQ("");
  };

  // --- Booking ---
  const bookSlot = async () => {
    setMsg("");
    setSlotFullOpen(false);

    if (!gameId) {
      setMsg("Please select a game.");
      return;
    }

    if (booking) return;
    setBooking(true);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const jwt = sess?.session?.access_token;

      if (!jwt) {
        router.replace("/login?next=/select");
        return;
      }

      // ✅ automatic players
      const players = computedPlayers;

      // ✅ safety: player_user_ids = selectedIds (limited)
      const player_user_ids = uniqStrings(selectedIds).slice(0, 9);

      const res = await fetch("/api/sessions/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          game_id: gameId,
          players, // ✅ AUTO
          player_user_ids, // ✅ who you added
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
    } catch (e: any) {
      setMsg(e?.message || "Booking failed");
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
              <br />
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
        <div className="text-white/60 text-sm mt-1">Choose game & add other players.</div>

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
                Duration: {selectedGame.duration_minutes} mins • Slots: {selectedGame.court_count}
              </>
            ) : loadingGames ? (
              "Loading games..."
            ) : (
              "-"
            )}
          </div>
        </div>

        {/* ✅ AUTO PLAYERS (read-only) */}
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
          <div className="text-lg font-bold mt-1">
            {computedPlayers} Player{computedPlayers > 1 ? "s" : ""}
          </div>
          
        </div>

        {/* Add other players */}
        <div className="mt-4 text-left">
          <div className="flex items-center justify-between">
            <label className="text-xs text-white/60">Add other players</label>

            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={clearAllPlayers}
                disabled={booking}
                className="text-xs text-white/50 hover:text-white underline"
                title="Remove all added players"
              >
                Clear all
              </button>
            )}
          </div>

          <input
            className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none text-white"
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
                  onClick={() => removePlayerById(id)}
                  disabled={booking}
                  className="text-xs rounded-full border border-white/10 bg-white/5 px-3 py-1 hover:bg-white/10"
                  title="Remove"
                >
                  Added • {id.slice(0, 6)}… ✕
                </button>
              ))}
            </div>
          )}

          {/* Results list */}
          <div className="mt-2 rounded-xl border border-white/10 bg-black/30 overflow-hidden">
            {searching ? (
              <div className="px-4 py-3 text-sm text-white/60">Searching...</div>
            ) : hits.length === 0 ? (
              <div className="px-4 py-3 text-sm text-white/60">
                {q.trim().length >= 2 ? "No matches." : "Type 2+ characters to search."}
              </div>
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
                    onClick={() => addPlayer(u)}
                    disabled={booking || selectedIds.length >= 9} // max others
                    className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-40"
                    title={selectedIds.length >= 9 ? "Max players reached" : "Add"}
                  >
                    + Add
                  </button>
                </div>
              ))
            )}
          </div>

          {selectedIds.length >= 9 && (
            <div className="mt-2 text-xs text-yellow-300">
              Max players reached (10 total including you).
            </div>
          )}
        </div>

        {/* Book button */}
        <button
          type="button"
          onClick={bookSlot}
          disabled={booking || !gameId}
          className="w-full mt-5 rounded-xl py-3 font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {booking ? "Booking..." : `Book Slot (${computedPlayers} Player${computedPlayers > 1 ? "s" : ""})`}
        </button>
      </div>
    </main>
  );
}