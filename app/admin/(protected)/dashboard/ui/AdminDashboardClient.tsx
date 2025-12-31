"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Row = {
  id: string;
  created_at: string;

  full_name: string | null;
  phone: string | null;
  email: string | null;

  game_name: string | null;
  slot_start: string | null;
  slot_end: string | null;

  status: string | null;
  exit_time: string | null; // ✅ scan time
};

function dt(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}

function t(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AdminDashboardClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sessions", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Failed to load");
        return;
      }
      setRows(data.rows || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const genQr = async (session_id: string) => {
    setMsg("");
    setQrUrl("");

    const res = await fetch("/api/admin/exit-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data?.error || "Failed to generate QR");
      return;
    }

    const url = await QRCode.toDataURL(data.exit_url, { width: 220, margin: 1 });
    setQrUrl(url);
  };

  return (
    <div className="text-white">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Visitors</h1>
          <p className="text-white/60 text-sm">Active sessions timeline + Generate Exit QR.</p>
        </div>

        <button
          onClick={load}
          className="rounded-lg bg-white text-black px-4 py-2 font-semibold"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {msg && <div className="mt-3 text-red-300 text-sm">{msg}</div>}

      {qrUrl && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 inline-block">
          <div className="text-sm font-semibold mb-2">Exit QR</div>
          <img src={qrUrl} alt="Exit QR" className="rounded-lg" />
        </div>
      )}

      <div className="mt-6 overflow-auto rounded-xl border border-white/10 bg-[#0b0b0b]">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="p-3 text-left">Timestamp</th>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Phone</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Game</th>
              <th className="p-3 text-left">Slot</th>

              {/* ✅ NEW COLUMN */}
              <th className="p-3 text-left">Exit Time</th>

              <th className="p-3 text-left">QR</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const completed =
                (r.status || "").toLowerCase() === "ended" || !!r.exit_time;

              return (
                <tr key={r.id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="p-3">{dt(r.created_at)}</td>
                  <td className="p-3">{r.full_name || "-"}</td>
                  <td className="p-3">{r.phone || "-"}</td>
                  <td className="p-3">{r.email || "-"}</td>
                  <td className="p-3">{r.game_name || "-"}</td>
                  <td className="p-3">
                    {r.slot_start ? `${t(r.slot_start)} – ${t(r.slot_end)}` : "-"}
                  </td>

                  {/* ✅ scan time */}
                  <td className="p-3">{t(r.exit_time)}</td>

                  <td className="p-3">
                    {completed ? (
                      <span className="text-white/60 font-semibold">Session Completed</span>
                    ) : (
                      <button
                        onClick={() => genQr(r.id)}
                        className="rounded-lg bg-blue-600 px-3 py-2 font-semibold hover:bg-blue-500"
                      >
                        Generate QR
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td className="p-4 text-white/60" colSpan={8}>
                  No sessions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}