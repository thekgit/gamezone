"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Row = {
  id: string;
  status: string;
  timestamp: string | null;
  name: string;
  phone: string;
  email: string;
  game: string;
  start_time: string | null;
  end_time: string | null;
  exit_time: string | null; // ended_at
};

function fmtDateTime(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}

function fmtTime(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtSlot(startIso: string | null, endIso: string | null) {
  if (!startIso) return "-";
  const start = fmtTime(startIso);
  const end = endIso ? fmtTime(endIso) : "-";
  return `${start} – ${end}`;
}

export default function VisitorsTableClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrForSession, setQrForSession] = useState("");

  const fetchRows = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/visitors", { cache: "no-store" });
      const out = await res.json().catch(() => ({}));
      setRows(out?.rows || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const onGenerateQR = async (session_id: string) => {
    setQrDataUrl("");
    setQrForSession(session_id);

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

    const url = String(out.exit_url || "");
    if (!url) {
      alert("Exit URL missing");
      return;
    }

    const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 420 });
    setQrDataUrl(dataUrl);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-3xl font-bold text-white">Visitors</h1>
          <p className="text-white/60 text-sm mt-1">Active sessions timeline + Generate Exit QR.</p>
        </div>
        <button
          onClick={fetchRows}
          className="rounded-xl bg-white text-black px-5 py-3 font-semibold"
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {!!qrDataUrl && (
        <div className="mb-6 w-[340px] rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-white font-semibold mb-3">Exit QR</div>
          <img src={qrDataUrl} alt="Exit QR" className="w-full rounded-xl bg-white p-3" />
          <div className="text-white/50 text-xs mt-2">Session: {qrForSession}</div>
        </div>
      )}

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
              <th className="text-left px-4 py-3">Exit Time</th>
              <th className="text-left px-4 py-3">QR</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const ended = r.status === "ended" || !!r.exit_time;

              return (
                <tr key={r.id} className="border-b border-white/10 last:border-0">
                  <td className="px-4 py-4">{fmtDateTime(r.timestamp)}</td>
                  <td className="px-4 py-4">{r.name || "-"}</td>
                  <td className="px-4 py-4">{r.phone || "-"}</td>
                  <td className="px-4 py-4">{r.email || "-"}</td>
                  <td className="px-4 py-4">{r.game}</td>
                  <td className="px-4 py-4">{fmtSlot(r.start_time, r.end_time)}</td>
                  <td className="px-4 py-4">{fmtTime(r.exit_time)}</td>

                  <td className="px-4 py-4">
                    {ended ? (
                      <span className="text-white/50 font-semibold">Session Completed</span>
                    ) : (
                      <button
                        onClick={() => onGenerateQR(r.id)}
                        className="rounded-xl bg-blue-600 px-5 py-2 font-semibold"
                      >
                        Generate QR
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}

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