"use client";

import { useEffect, useState } from "react";

type VisitorRow = {
  id: string;
  timestamp: string; // whatever you're showing now
  name: string;
  phone: string;
  email: string;
  game: string;
  slot: string;
  ended_at?: string | null; // ✅ must come from API
};

function fmtTime(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function VisitorsTableClient() {
  const [rows, setRows] = useState<VisitorRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/visitors", { cache: "no-store" });
      const out = await res.json();
      setRows(out?.rows || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="w-full">
      <div className="flex justify-end mb-4">
        <button
          onClick={load}
          className="rounded-xl bg-white text-black px-5 py-3 font-semibold"
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <table className="w-full text-sm text-white">
          <thead className="text-white/60">
            <tr className="border-b border-white/10">
              <th className="text-left px-4 py-3">Timestamp</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Phone</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Game</th>
              <th className="text-left px-4 py-3">Slot</th>

              {/* ✅ NEW COLUMN */}
              <th className="text-left px-4 py-3">Exit Time</th>

              <th className="text-left px-4 py-3">QR</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-white/10 last:border-0">
                <td className="px-4 py-4">{r.timestamp || "-"}</td>
                <td className="px-4 py-4">{r.name || "-"}</td>
                <td className="px-4 py-4">{r.phone || "-"}</td>
                <td className="px-4 py-4">{r.email || "-"}</td>
                <td className="px-4 py-4">{r.game || "-"}</td>
                <td className="px-4 py-4">{r.slot || "-"}</td>

                {/* ✅ NEW DATA */}
                <td className="px-4 py-4">{fmtTime(r.ended_at)}</td>

                {/* ✅ keep your existing QR button here (unchanged for now) */}
                <td className="px-4 py-4">
                  <button className="rounded-xl bg-blue-600 px-4 py-2 font-semibold">
                    Generate QR
                  </button>
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td className="px-4 py-8 text-white/50" colSpan={8}>
                  No sessions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}