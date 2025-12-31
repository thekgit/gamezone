"use client";

import { useEffect, useMemo, useState } from "react";

type GameRow = {
  id: string;
  name: string;
  duration_minutes: number;
  courts: number;
  price: number;
};

type DiscountRow = {
  id: string;
  game_id: string | null;
  offer_date: string; // yyyy-mm-dd
  offer_end_date: string;
  discount_percent: number;
  discount_start_time: string; // HH:MM:SS or HH:MM
  discount_end_time: string;
  created_at: string;
};

export default function GamesClient() {
  const [msg, setMsg] = useState("");
  const [games, setGames] = useState<GameRow[]>([]);
  const [discounts, setDiscounts] = useState<DiscountRow[]>([]);
  const [loading, setLoading] = useState(false);

  // ---- Add game form
  const [gName, setGName] = useState("");
  const [gDuration, setGDuration] = useState(60);
  const [gCourts, setGCourts] = useState(1);
  const [gPrice, setGPrice] = useState(0);

  // ---- Add discount form
  const [dGameId, setDGameId] = useState<string | "">("");
  const [dOfferDate, setDOfferDate] = useState("");
  const [dOfferEndDate, setDOfferEndDate] = useState("");
  const [dPercent, setDPercent] = useState(0);
  const [dStartTime, setDStartTime] = useState("10:00");
  const [dEndTime, setDEndTime] = useState("12:00");

  const gameNameById = useMemo(() => {
    const m = new Map<string, string>();
    games.forEach((g) => m.set(g.id, g.name));
    return m;
  }, [games]);

  const loadAll = async () => {
    setMsg("");
    setLoading(true);
    try {
      const [gRes, dRes] = await Promise.all([
        fetch("/api/admin/games", { cache: "no-store" }),
        fetch("/api/admin/discounts", { cache: "no-store" }),
      ]);

      const gJson = await gRes.json().catch(() => ({}));
      const dJson = await dRes.json().catch(() => ({}));

      if (!gRes.ok) throw new Error(gJson?.error || "Failed loading games");
      if (!dRes.ok) throw new Error(dJson?.error || "Failed loading discounts");

      setGames(gJson.games || []);
      setDiscounts(dJson.discounts || []);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // ---------- GAMES CRUD ----------
  const addGame = async () => {
    setMsg("");
    if (!gName.trim()) return setMsg("Game name is required.");

    const res = await fetch("/api/admin/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: gName.trim(),
        duration_minutes: Number(gDuration) || 60,
        courts: Number(gCourts) || 1,
        price: Number(gPrice) || 0,
      }),
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(out?.error || "Failed to add game");

    setGName("");
    setGDuration(60);
    setGCourts(1);
    setGPrice(0);
    await loadAll();
  };

  const saveGame = async (g: GameRow) => {
    setMsg("");
    const res = await fetch("/api/admin/games", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(g),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(out?.error || "Failed to save game");
    await loadAll();
  };

  // ---------- DISCOUNTS CRUD ----------
  const addDiscount = async () => {
    setMsg("");
    if (!dOfferDate || !dOfferEndDate) return setMsg("Offer date and end date are required.");

    const res = await fetch("/api/admin/discounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game_id: dGameId || null,
        offer_date: dOfferDate,
        offer_end_date: dOfferEndDate,
        discount_percent: Number(dPercent) || 0,
        discount_start_time: dStartTime,
        discount_end_time: dEndTime,
      }),
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(out?.error || "Failed to add discount");

    setDGameId("");
    setDOfferDate("");
    setDOfferEndDate("");
    setDPercent(0);
    setDStartTime("10:00");
    setDEndTime("12:00");
    await loadAll();
  };

  const deleteDiscount = async (id: string) => {
    setMsg("");
    const res = await fetch("/api/admin/discounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(out?.error || "Failed to delete discount");
    await loadAll();
  };

  return (
    <div className="text-white">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Games</h1>
          <p className="text-white/60 text-sm">Manage games + discounts.</p>
        </div>
        <button
          onClick={loadAll}
          className="rounded-lg bg-white/10 px-4 py-2 font-semibold hover:bg-white/15"
        >
          {loading ? "Loading..." : "Reload"}
        </button>
      </div>

      {msg && <div className="mt-3 text-red-300 text-sm">{msg}</div>}

      {/* SECTION 1: Add New Game */}
      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="font-semibold mb-3">1) Add new game</div>

        <div className="grid gap-3 md:grid-cols-4">
          <input
            className="rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
            placeholder="Game name (ex Cricket)"
            value={gName}
            onChange={(e) => setGName(e.target.value)}
          />

          <input
            className="rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
            type="number"
            min={1}
            placeholder="Timing (minutes)"
            value={gDuration}
            onChange={(e) => setGDuration(Number(e.target.value))}
          />

          <input
            className="rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
            type="number"
            min={1}
            placeholder="Table/Court count"
            value={gCourts}
            onChange={(e) => setGCourts(Number(e.target.value))}
          />

          <input
            className="rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
            type="number"
            min={0}
            placeholder="Price"
            value={gPrice}
            onChange={(e) => setGPrice(Number(e.target.value))}
          />
        </div>

        <button
          onClick={addGame}
          className="mt-4 rounded-lg bg-white text-black px-4 py-2 font-semibold hover:opacity-90"
        >
          Add Game
        </button>
      </div>

      {/* Existing games table */}
      <div className="mt-4 overflow-auto rounded-xl border border-white/10 bg-[#0b0b0b]">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="p-3 text-left">Game</th>
              <th className="p-3 text-left">Timing (min)</th>
              <th className="p-3 text-left">Tables/Courts</th>
              <th className="p-3 text-left">Price</th>
              <th className="p-3 text-left">Save</th>
            </tr>
          </thead>
          <tbody>
            {games.map((g, idx) => (
              <tr key={g.id} className="border-t border-white/10">
                <td className="p-3">
                  <input
                    className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
                    value={g.name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setGames((prev) => prev.map((x, i) => (i === idx ? { ...x, name: v } : x)));
                    }}
                  />
                </td>

                <td className="p-3">
                  <input
                    className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
                    type="number"
                    min={1}
                    value={g.duration_minutes}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setGames((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, duration_minutes: v } : x))
                      );
                    }}
                  />
                </td>

                <td className="p-3">
                  <input
                    className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
                    type="number"
                    min={1}
                    value={g.courts}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setGames((prev) => prev.map((x, i) => (i === idx ? { ...x, courts: v } : x)));
                    }}
                  />
                </td>

                <td className="p-3">
                  <input
                    className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
                    type="number"
                    min={0}
                    value={g.price}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setGames((prev) => prev.map((x, i) => (i === idx ? { ...x, price: v } : x)));
                    }}
                  />
                </td>

                <td className="p-3">
                  <button
                    onClick={() => saveGame(g)}
                    className="rounded-lg bg-blue-600 px-3 py-2 font-semibold hover:bg-blue-500"
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))}

            {games.length === 0 && (
              <tr>
                <td className="p-4 text-white/60" colSpan={5}>
                  No games found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SECTION 2: Discount value */}
      <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="font-semibold mb-3">2) Discount value</div>

        <div className="grid gap-3 md:grid-cols-6">
          <select
            className="rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
            value={dGameId}
            onChange={(e) => setDGameId(e.target.value)}
          >
            <option value="">All Games (optional)</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          <input
            className="rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
            type="date"
            value={dOfferDate}
            onChange={(e) => setDOfferDate(e.target.value)}
          />

          <input
            className="rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
            type="date"
            value={dOfferEndDate}
            onChange={(e) => setDOfferEndDate(e.target.value)}
          />

          <input
            className="rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
            type="number"
            min={0}
            max={100}
            step="0.01"
            placeholder="Discount %"
            value={dPercent}
            onChange={(e) => setDPercent(Number(e.target.value))}
          />

          <input
            className="rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
            type="time"
            value={dStartTime}
            onChange={(e) => setDStartTime(e.target.value)}
          />

          <input
            className="rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
            type="time"
            value={dEndTime}
            onChange={(e) => setDEndTime(e.target.value)}
          />
        </div>

        <button
          onClick={addDiscount}
          className="mt-4 rounded-lg bg-white text-black px-4 py-2 font-semibold hover:opacity-90"
        >
          Add Discount
        </button>
      </div>

      {/* Discounts table */}
      <div className="mt-4 overflow-auto rounded-xl border border-white/10 bg-[#0b0b0b]">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="p-3 text-left">Game</th>
              <th className="p-3 text-left">Offer Date</th>
              <th className="p-3 text-left">Offer End Date</th>
              <th className="p-3 text-left">Discount %</th>
              <th className="p-3 text-left">Start</th>
              <th className="p-3 text-left">End</th>
              <th className="p-3 text-left">Delete</th>
            </tr>
          </thead>
          <tbody>
            {discounts.map((d) => (
              <tr key={d.id} className="border-t border-white/10">
                <td className="p-3">{d.game_id ? (gameNameById.get(d.game_id) || "Unknown") : "All Games"}</td>
                <td className="p-3">{d.offer_date}</td>
                <td className="p-3">{d.offer_end_date}</td>
                <td className="p-3">{d.discount_percent}</td>
                <td className="p-3">{d.discount_start_time}</td>
                <td className="p-3">{d.discount_end_time}</td>
                <td className="p-3">
                  <button
                    onClick={() => deleteDiscount(d.id)}
                    className="rounded-lg bg-red-600 px-3 py-2 font-semibold hover:bg-red-500"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {discounts.length === 0 && (
              <tr>
                <td className="p-4 text-white/60" colSpan={7}>
                  No discounts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}