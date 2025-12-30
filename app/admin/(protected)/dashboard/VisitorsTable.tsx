"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  session_id: string;
  created_at: string;
  user_id: string;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  game?: string | null;
  slot_label?: string | null;
};

function fmt(dt: string) {
  try {
    const d = new Date(dt);
    return d.toLocaleString();
  } catch {
    return dt;
  }
}

export default function VisitorsTable() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string>("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/sessions", { cache: "no-store" });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(out?.error || "Failed to load sessions");
        setRows([]);
        return;
      }
      setRows(out?.rows || out?.data || []);
    } catch (e: any) {
      setErr(e?.message || "Network error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const blob = [
        r.full_name,
        r.email,
        r.phone,
        r.user_id,
        r.session_id,
        r.game,
        r.slot_label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(s);
    });
  }, [q, rows]);

  async function genQR(session_id: string) {
    setErr("");
    try {
      const res = await fetch("/api/admin/exit-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(out?.error || "Failed to generate QR");
        return;
      }
      // simplest: show code in alert (later we will render QR image)
      alert(`Exit Code: ${out.code || out.exit_code || "generated"}`);
    } catch (e: any) {
      setErr(e?.message || "Network error");
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-black/10">
      <div className="p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm text-black/60">Visitors / List</div>
          <div className="text-2xl font-bold text-black">All Visitors</div>
        </div>

        <div className="flex items-center gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search visitors..."
            className="w-80 px-4 py-2 rounded-lg border border-black/15 text-black outline-none focus:border-black/30"
          />
          <button
            onClick={load}
            className="px-4 py-2 rounded-lg bg-black text-white hover:bg-black/90"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {err && (
        <div className="px-5 pb-3 text-sm text-red-600">
          {err}
        </div>
      )}

      <div className="px-5 pb-5 overflow-x-auto">
        <table className="w-full border border-black/10 rounded-lg overflow-hidden">
          <thead className="bg-gray-100">
            <tr className="text-left text-xs font-semibold text-black/70">
              <th className="px-4 py-3">Booking Timestamp</th>
              <th className="px-4 py-3">Session ID</th>
              <th className="px-4 py-3">User ID</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Game</th>
              <th className="px-4 py-3">Slot</th>
              <th className="px-4 py-3">QR</th>
            </tr>
          </thead>

          <tbody className="bg-black">
            {filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-black/60" colSpan={9}>
                  {loading ? "Loading..." : "No records found."}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.session_id} className="border-t border-black/10 text-sm text-black">
                  <td className="px-4 py-3">{fmt(r.created_at)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.session_id}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.user_id}</td>
                  <td className="px-4 py-3">{r.phone || "-"}</td>
                  <td className="px-4 py-3">{r.email || "-"}</td>
                  <td className="px-4 py-3">{r.full_name || "-"}</td>
                  <td className="px-4 py-3">{r.game || "-"}</td>
                  <td className="px-4 py-3">{r.slot_label || "-"}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => genQR(r.session_id)}
                      className="px-3 py-2 rounded-md bg-[#1f6feb] text-white text-xs font-semibold hover:bg-[#1a5fd0]"
                    >
                      Generate QR
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="mt-3 text-xs text-black/50">
          Showing {filtered.length} record(s)
        </div>
      </div>
    </div>
  );
}