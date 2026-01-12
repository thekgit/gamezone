"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  id: string;
  status: string | null;
  timestamp: string | null;
  name: string;
  phone: string;
  email: string;
  game: string;
  start_time: string | null;
  end_time: string | null;
  exit_time: string | null;
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}

function fmtTime(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtSlot(start?: string | null, end?: string | null) {
  if (!start || !end) return "-";
  return `${fmtTime(start)} – ${fmtTime(end)}`;
}

export default function VisitorsTableClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/visitors", { cache: "no-store" });
      const out = await res.json().catch(() => ({}));
      setRows(Array.isArray(out?.rows) ? out.rows : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      return tb - ta;
    });
  }, [rows]);

  const generateQr = async (session_id: string) => {
    const res = await fetch("/api/admin/exit-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id }),
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(out?.error || "Failed to generate QR");
      return;
    }

    await load();
  };

  return (
    <div className="w-full">
      {/* Top actions */}
      <div className="flex justify-end mb-4">
        <button
          onClick={load}
          className="rounded-xl bg-white text-black px-5 py-3 font-semibold"
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Table container */}
      <div className="w-full overflow-x-auto">
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur overflow-hidden">
          <table className="min-w-[1100px] w-full text-sm text-white">
            <thead className="text-white/60 border-b border-white/10">
              <tr>
                <th className="text-left px-4 py-3">Timestamp</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Game</th>
                <th className="text-left px-4 py-3">Slot</th>
                <th className="text-left px-4 py-3">Exit Time</th>
                <th className="text-left px-4 py-3">QR</th>
              </tr>
            </thead>

            <tbody>
              {sorted.map((r) => {
                const isCompleted =
                  (r.status || "").toLowerCase() === "ended" || !!r.exit_time;

                return (
                  <tr
                    key={r.id}
                    className="border-b border-white/10 last:border-0 hover:bg-white/5"
                  >
                    <td className="px-4 py-4">{fmtDateTime(r.timestamp)}</td>
                    <td className="px-4 py-4">{r.name || "-"}</td>
                    <td className="px-4 py-4">{r.phone || "-"}</td>
                    <td className="px-4 py-4">{r.email || "-"}</td>
                    <td className="px-4 py-4">{r.game || "-"}</td>
                    <td className="px-4 py-4">
                      {fmtSlot(r.start_time, r.end_time)}
                    </td>
                    <td className="px-4 py-4">{fmtTime(r.exit_time)}</td>
                    <td className="px-4 py-4">
                      {isCompleted ? (
                        <span className="text-white/60 font-semibold">
                          Session Completed
                        </span>
                      ) : (
                        <button
                          onClick={() => generateQr(r.id)}
                          className="rounded-xl bg-blue-600 px-4 py-2 font-semibold hover:bg-blue-500"
                        >
                          Generate QR
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!sorted.length && (
                <tr>
                  <td
                    className="px-4 py-10 text-white/50 text-center"
                    colSpan={8}
                  >
                    No sessions yet.
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