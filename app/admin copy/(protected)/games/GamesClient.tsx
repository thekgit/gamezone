"use client";

import { useEffect, useMemo, useState } from "react";

type GameRow = {
  id: string;
  key: string;
  name: string;
  duration_minutes: number;
  court_count: number;
  capacity_per_slot: number;
  price_rupees: number;
  is_active: boolean;
  created_at?: string;
};

function slotButtonClass(occupied: boolean) {
  return (
    "px-3 py-1 rounded-full text-xs font-semibold border select-none " +
    (occupied
      ? "bg-green-600 text-white border-green-500"
      : "bg-white/10 text-white border-white/15")
  );
}

export default function GamesClient() {
  const [msg, setMsg] = useState("");
  const [games, setGames] = useState<GameRow[]>([]);
  const [activeByGame, setActiveByGame] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // Add game form
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(60);
  const [courts, setCourts] = useState(1);
  const [price, setPrice] = useState(0);

  // Discount UI (not persisted yet)
  const [offerDate, setOfferDate] = useState("");
  const [offerEndDate, setOfferEndDate] = useState("");
  const [discount, setDiscount] = useState("");
  const [discountStartTime, setDiscountStartTime] = useState("");
  const [discountEndTime, setDiscountEndTime] = useState("");

  // inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<GameRow>>({});

  const load = async () => {
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/games", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Failed to load games");
        return;
      }
      setGames((data.games || []) as GameRow[]);
      setActiveByGame((data.activeByGame || {}) as Record<string, number>);
    } finally {
      setLoading(false);
    }
  };

  // auto refresh so slot colors update
  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  const activeGames = useMemo(() => games.filter((g) => g.is_active !== false), [games]);

  const createGame = async () => {
    setMsg("");
    const res = await fetch("/api/admin/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        duration_minutes: Number(duration || 60),
        court_count: Number(courts || 1),
        price_rupees: Number(price || 0),
        capacity_per_slot: 1, // ✅ required NOT NULL in your DB
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data?.error || "Failed to create");
      return;
    }

    setName("");
    setDuration(60);
    setCourts(1);
    setPrice(0);
    await load();
    setMsg("Game added.");
  };

  const startEdit = (g: GameRow) => {
    setEditingId(g.id);
    setEditDraft({ ...g });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setMsg("");

    const res = await fetch("/api/admin/games", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId,
        name: String(editDraft.name || "").trim(),
        duration_minutes: Number(editDraft.duration_minutes ?? 60),
        court_count: Number(editDraft.court_count ?? 1),
        price_rupees: Number(editDraft.price_rupees ?? 0),
        capacity_per_slot: Number(editDraft.capacity_per_slot ?? 1),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data?.error || "Failed to update");
      return;
    }

    setEditingId(null);
    setEditDraft({});
    await load();
    setMsg("Game updated.");
  };

  const archiveGame = async (id: string) => {
    if (!confirm("Delete this game? (It will be hidden from bookings)")) return;

    setMsg("");
    const res = await fetch("/api/admin/games", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data?.error || "Failed to delete");
      return;
    }

    await load();
    setMsg("Game archived.");
  };

  return (
    <div className="text-white">
      {msg && <div className="mb-4 text-sm text-green-300">{msg}</div>}

      {/* TOP FORMS */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Add New Game */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="font-semibold">Add New Game</div>
          <div className="text-xs text-white/50 mb-4">This is used in bookings.</div>

          <label className="text-xs text-white/60">Game name</label>
          <input
            className="mt-2 mb-3 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none"
            placeholder="ex: Cricket"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className="text-xs text-white/60">Timing (minutes)</label>
          <input
            className="mt-2 mb-3 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none"
            type="number"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />

          <label className="text-xs text-white/60">Table / Court count (slots)</label>
          <input
            className="mt-2 mb-3 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none"
            type="number"
            value={courts}
            onChange={(e) => setCourts(Number(e.target.value))}
          />

          <label className="text-xs text-white/60">Price (₹)</label>
          <input
            className="mt-2 mb-4 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none"
            type="number"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />

          <button
            onClick={createGame}
            disabled={!name.trim()}
            className="w-full rounded-xl py-3 font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40"
          >
            Save Game
          </button>
        </div>

        {/* Discount Section (UI only) */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="font-semibold">Discount Value</div>
          <div className="text-xs text-white/50 mb-4">UI only right now.</div>

          <label className="text-xs text-white/60">Offer date</label>
          <input
            className="mt-2 mb-3 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none"
            type="date"
            value={offerDate}
            onChange={(e) => setOfferDate(e.target.value)}
          />

          <label className="text-xs text-white/60">Offer end date</label>
          <input
            className="mt-2 mb-3 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none"
            type="date"
            value={offerEndDate}
            onChange={(e) => setOfferEndDate(e.target.value)}
          />

          <label className="text-xs text-white/60">Offer discount (%)</label>
          <input
            className="mt-2 mb-3 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none"
            type="number"
            placeholder="ex: 10"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />

          <label className="text-xs text-white/60">Discount start time</label>
          <input
            className="mt-2 mb-3 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none"
            type="time"
            value={discountStartTime}
            onChange={(e) => setDiscountStartTime(e.target.value)}
          />

          <label className="text-xs text-white/60">Discount end time</label>
          <input
            className="mt-2 mb-4 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none"
            type="time"
            value={discountEndTime}
            onChange={(e) => setDiscountEndTime(e.target.value)}
          />

          <button
            onClick={() => setMsg("Discount UI saved locally (not stored yet).")}
            className="w-full rounded-xl py-3 font-semibold bg-blue-600 hover:bg-blue-500"
          >
            Save Discount (UI)
          </button>
        </div>
      </div>

      {/* GAMES LIST */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-[#0b0b0b] overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="font-semibold">Games</div>
            <div className="text-xs text-white/50">
              Status shows slot occupancy (green = booked).
            </div>
          </div>
          <button
            onClick={load}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15"
          >
            Reload
          </button>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/70">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Timing</th>
                <th className="p-3 text-left">Table/Court</th>
                <th className="p-3 text-left">Price</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {activeGames.map((g) => {
                const isEditing = editingId === g.id;
                const active = activeByGame[g.id] || 0;
                const total = Number(g.court_count || 0);

                return (
                  <tr key={g.id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="p-3">
                      {isEditing ? (
                        <input
                          className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 outline-none"
                          value={String(editDraft.name ?? "")}
                          onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                        />
                      ) : (
                        <span className="font-semibold">{g.name}</span>
                      )}
                    </td>

                    <td className="p-3">
                      {isEditing ? (
                        <input
                          className="w-28 rounded-lg bg-black/40 border border-white/10 px-3 py-2 outline-none"
                          type="number"
                          value={Number(editDraft.duration_minutes ?? 60)}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, duration_minutes: Number(e.target.value) }))
                          }
                        />
                      ) : (
                        `${g.duration_minutes} min`
                      )}
                    </td>

                    <td className="p-3">
                      {isEditing ? (
                        <input
                          className="w-20 rounded-lg bg-black/40 border border-white/10 px-3 py-2 outline-none"
                          type="number"
                          value={Number(editDraft.court_count ?? 1)}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, court_count: Number(e.target.value) }))
                          }
                        />
                      ) : (
                        g.court_count
                      )}
                    </td>

                    <td className="p-3">
                      {isEditing ? (
                        <input
                          className="w-24 rounded-lg bg-black/40 border border-white/10 px-3 py-2 outline-none"
                          type="number"
                          value={Number(editDraft.price_rupees ?? 0)}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, price_rupees: Number(e.target.value) }))
                          }
                        />
                      ) : (
                        `₹${g.price_rupees}`
                      )}
                    </td>

                    {/* ✅ SLOT BUTTONS */}
                    <td className="p-3">
                      {total > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {Array.from({ length: total }).map((_, i) => {
                            const occupied = i < active;
                            return (
                              <span key={i} className={slotButtonClass(occupied)}>
                                Slot {i + 1}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-white/40">-</span>
                      )}
                    </td>

                    <td className="p-3">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button
                            onClick={saveEdit}
                            className="rounded-lg bg-blue-600 px-3 py-2 font-semibold hover:bg-blue-500"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditDraft({});
                            }}
                            className="rounded-lg bg-white/10 px-3 py-2 font-semibold hover:bg-white/15"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(g)}
                            className="rounded-lg bg-white/10 px-3 py-2 font-semibold hover:bg-white/15"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => archiveGame(g.id)}
                            className="rounded-lg bg-red-600/80 px-3 py-2 font-semibold hover:bg-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {activeGames.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-white/60">
                    {loading ? "Loading..." : "No games found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}