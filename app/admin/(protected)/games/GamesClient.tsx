"use client";

import { useState } from "react";

export default function GamesClient() {
  // --- Add New Game form state ---
  const [gameName, setGameName] = useState("");
  const [timing, setTiming] = useState("1 hour");
  const [courts, setCourts] = useState("2");
  const [price, setPrice] = useState("");

  // --- Discount form state ---
  const [offerDate, setOfferDate] = useState("");
  const [offerEndDate, setOfferEndDate] = useState("");
  const [discount, setDiscount] = useState("");
  const [discountStartTime, setDiscountStartTime] = useState("");
  const [discountEndTime, setDiscountEndTime] = useState("");

  // Right now just placeholder submit handlers (no DB changes)
  const onSaveGame = async () => {
    const timing_minutes =
      String(timing).includes("hour") ? 60 : Number(timing) || 60;
  
    const res = await fetch("/api/admin/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: gameName,
        timing_minutes,
        courts: Number(courts || 1),
        price: Number(price || 0),
      }),
    });
  
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data?.error || "Failed to save game");
  
    alert("Game saved ✅");
    setGameName("");
    setTiming("1 hour");
    setCourts("2");
    setPrice("");
  };
  
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

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
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
            Save Game (for now)
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
            Save Discount (for now)
          </button>
        </div>
      </div>
    </div>
  );
}