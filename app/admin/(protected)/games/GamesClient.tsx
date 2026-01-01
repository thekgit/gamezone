"use client";

import { useEffect, useState } from "react";

type GameRow = {
  id: string;
  name: string;
  duration_minutes: number;
  court_count: number;
  price: number;
  is_active: boolean;
  created_at: string;
};

function minsToLabel(mins: number) {
  if (!mins || mins <= 0) return "-";
  if (mins % 60 === 0) return `${mins / 60} hour`;
  return `${mins} mins`;
}

export default function GamesClient() {
  // --- Add New Game form state ---
  const [gameName, setGameName] = useState("");
  const [timing, setTiming] = useState("1 hour"); // accepts "1 hour" or "60"
  const [courts, setCourts] = useState("2");
  const [price, setPrice] = useState("");

  // --- Discount form state (kept as-is) ---
  const [offerDate, setOfferDate] = useState("");
  const [offerEndDate, setOfferEndDate] = useState("");
  const [discount, setDiscount] = useState("");
  const [discountStartTime, setDiscountStartTime] = useState("");
  const [discountEndTime, setDiscountEndTime] = useState("");

  // --- List + edit state ---
  const [games, setGames] = useState<GameRow[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [msg, setMsg] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editMins, setEditMins] = useState("60");
  const [editCourts, setEditCourts] = useState("1");
  const [editPrice, setEditPrice] = useState("0");

  const loadGames = async () => {
    setMsg("");
    setLoadingGames(true);
    try {
      const res = await fetch("/api/admin/games", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Failed to load games");
        return;
      }
      setGames(data?.games || []);
    } finally {
      setLoadingGames(false);
    }
  };

  useEffect(() => {
    loadGames();
  }, []);

  const parseTimingToMinutes = (val: string) => {
    const s = String(val || "").trim().toLowerCase();
    if (!s) return 60;
    if (s.includes("hour")) return 60; // simple: default 1 hour
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : 60;
  };
  
  // ✅ Save new game
  const timing_minutes =
  String(timing).toLowerCase().includes("hour") ? 60 : Number(timing) || 60;

  const res = await fetch("/api/admin/games", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: gameName,
    duration_minutes: timing_minutes,
    court_count: Number(courts || 1),      // table/court count
    price_rupees: Number(price || 0),      // price in rupees
    capacity_per_slot: 1,                  // required by DB
   }),
   });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data?.error || "Failed to save game");

    alert("Game saved ✅");
    setGameName("");
    setTiming("1 hour");
    setCourts("2");
    setPrice("");

    // ✅ refresh list
    await loadGames();
  };

  // ✅ Discount save (kept your logic; assumes /api/admin/discounts exists)
  const onSaveDiscount = async () => {
    const res = await fetch("/api/admin/discounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offer_date: offerDate,
        offer_end_date: offerEndDate,
        discount_percent: Number(discount || 0),
        start_time: discountStartTime,
        end_time: discountEndTime,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data?.error || "Failed to save discount");

    alert("Discount saved ✅");
    setOfferDate("");
    setOfferEndDate("");
    setDiscount("");
    setDiscountStartTime("");
    setDiscountEndTime("");
  };

  // ✅ Start editing
  const startEdit = (g: GameRow) => {
    setEditingId(g.id);
    setEditName(g.name || "");
    setEditMins(String(g.duration_minutes ?? 60));
    setEditCourts(String(g.court_count ?? 1));
    setEditPrice(String(g.price ?? 0));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditMins("60");
    setEditCourts("1");
    setEditPrice("0");
  };

  // ✅ Update game
  const saveEdit = async (id: string) => {
    const res = await fetch("/api/admin/games", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        name: editName,
        duration_minutes: Number(editMins || 60),
        court_count: Number(editCourts || 1),
        price: Number(editPrice || 0),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data?.error || "Failed to update");

    cancelEdit();
    await loadGames();
  };

  // ✅ Delete game (soft delete = is_active false)
  const deleteGame = async (id: string) => {
    if (!confirm("Delete this game? (It will be hidden from bookings)")) return;

    const res = await fetch("/api/admin/games", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data?.error || "Failed to delete");

    await loadGames();
  };

  return (
    <div className="mt-6 space-y-6">
      {/* TOP FORMS */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* SECTION 1: Add new game */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-xl font-bold">Add New Game</h2>
          <p className="text-white/60 text-sm mt-1">
            Create a game entry (editable later).
          </p>

          <div className="mt-5 space-y-3">
            <div>
              <label className="text-xs text-white/60">Game name</label>
              <input
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="ex: Cricket"
                className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs text-white/60">Timing</label>
              <input
                value={timing}
                onChange={(e) => setTiming(e.target.value)}
                placeholder="ex: 1 hour"
                className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
              />
              <p className="text-xs text-white/40 mt-1">
                Tip: keep “1 hour” (60 minutes). You can also enter minutes like 90.
              </p>
            </div>

            <div>
              <label className="text-xs text-white/60">Table / Court count</label>
              <input
                value={courts}
                onChange={(e) => setCourts(e.target.value)}
                placeholder="ex: 2"
                inputMode="numeric"
                className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs text-white/60">Price</label>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="ex: 200"
                inputMode="numeric"
                className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
              />
            </div>

            <button
              onClick={onSaveGame}
              className="mt-3 w-full rounded-xl py-3 font-semibold bg-blue-600 hover:bg-blue-500"
            >
              Save Game
            </button>
          </div>
        </div>

        {/* SECTION 2: Discount value */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-xl font-bold">Discount Value</h2>
          <p className="text-white/60 text-sm mt-1">
            Set discount rules (editable later).
          </p>

          <div className="mt-5 space-y-3">
            <div>
              <label className="text-xs text-white/60">Offer date</label>
              <input
                type="date"
                value={offerDate}
                onChange={(e) => setOfferDate(e.target.value)}
                className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs text-white/60">Offer end date</label>
              <input
                type="date"
                value={offerEndDate}
                onChange={(e) => setOfferEndDate(e.target.value)}
                className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs text-white/60">Offer discount (%)</label>
              <input
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="ex: 10"
                inputMode="numeric"
                className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs text-white/60">Discount start time</label>
              <input
                type="time"
                value={discountStartTime}
                onChange={(e) => setDiscountStartTime(e.target.value)}
                className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs text-white/60">Discount end time</label>
              <input
                type="time"
                value={discountEndTime}
                onChange={(e) => setDiscountEndTime(e.target.value)}
                className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
              />
            </div>

            <button
              onClick={onSaveDiscount}
              className="mt-3 w-full rounded-xl py-3 font-semibold bg-blue-600 hover:bg-blue-500"
            >
              Save Discount
            </button>
          </div>
        </div>
      </div>

      {/* ✅ DOWNSIDE SECTION: GAMES LIST */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Games</h2>
            <p className="text-white/60 text-sm mt-1">
              This list is used in bookings. Edit/Delete updates the booking options.
            </p>
          </div>

          <button
            onClick={loadGames}
            className="rounded-lg bg-white/10 px-4 py-2 font-semibold hover:bg-white/15"
          >
            Reload
          </button>
        </div>

        {msg && <div className="mt-3 text-sm text-red-300">{msg}</div>}

        <div className="mt-4 overflow-auto rounded-xl border border-white/10 bg-black/30">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/70">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Timing</th>
                <th className="p-3 text-left">Table/Court</th>
                <th className="p-3 text-left">Price</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loadingGames ? (
                <tr>
                  <td className="p-4 text-white/60" colSpan={5}>
                    Loading games...
                  </td>
                </tr>
              ) : games.length === 0 ? (
                <tr>
                  <td className="p-4 text-white/60" colSpan={5}>
                    No games found.
                  </td>
                </tr>
              ) : (
                games.map((g) => {
                  const isEditing = editingId === g.id;

                  return (
                    <tr key={g.id} className="border-t border-white/10">
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 outline-none focus:border-white/30"
                          />
                        ) : (
                          <span className="font-semibold">{g.name}</span>
                        )}
                      </td>

                      <td className="p-3">
                        {isEditing ? (
                          <input
                            value={editMins}
                            onChange={(e) => setEditMins(e.target.value)}
                            inputMode="numeric"
                            className="w-32 rounded-lg bg-black/40 border border-white/10 px-3 py-2 outline-none focus:border-white/30"
                          />
                        ) : (
                          minsToLabel(g.duration_minutes)
                        )}
                      </td>

                      <td className="p-3">
                        {isEditing ? (
                          <input
                            value={editCourts}
                            onChange={(e) => setEditCourts(e.target.value)}
                            inputMode="numeric"
                            className="w-24 rounded-lg bg-black/40 border border-white/10 px-3 py-2 outline-none focus:border-white/30"
                          />
                        ) : (
                          g.court_count
                        )}
                      </td>

                      <td className="p-3">
                        {isEditing ? (
                          <input
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            inputMode="numeric"
                            className="w-28 rounded-lg bg-black/40 border border-white/10 px-3 py-2 outline-none focus:border-white/30"
                          />
                        ) : (
                          `₹${g.price}`
                        )}
                      </td>

                      <td className="p-3">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEdit(g.id)}
                              className="rounded-lg bg-blue-600 px-3 py-2 font-semibold hover:bg-blue-500"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
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
                              onClick={() => deleteGame(g.id)}
                              className="rounded-lg bg-red-600/80 px-3 py-2 font-semibold hover:bg-red-600"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}