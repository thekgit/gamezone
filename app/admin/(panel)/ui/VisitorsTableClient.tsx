"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type Row = {
  id: string;
  created_at: string;

  status: string | null;
  exit_token: string | null;

  ended_at: string | null;
  end_time: string | null;
  ends_at: string | null;

  full_name: string | null;
  phone: string | null;
  email: string | null;
  game_name: string | null;

  slot_start: string | null;
  slot_end: string | null;
};

function fmt(dt: string | null) {
  if (!dt) return "-";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function fmtTime(dt: string | null) {
  if (!dt) return "-";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function VisitorsTableClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const [qrUrl, setQrUrl] = useState<string>("");
  const [qrImg, setQrImg] = useState<string>("");

  const fetchRows = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/visitors", { cache: "no-store" });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setRows(out.rows || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const genQr = async (session_id: string) => {
    setQrImg("");
    setQrUrl("");

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

    const exit_url = String(out.exit_url || "");
    setQrUrl(exit_url);

    const dataUrl = await QRCode.toDataURL(exit_url, {
      margin: 1,
      width: 260,
      errorCorrectionLevel: "M",
    });

    setQrImg(dataUrl);

    // refresh
    fetchRows();
  };

  const tableRows = useMemo(() => rows, [rows]);

  return (
    <div className="w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Visitors</h1>
          <p className="text-white/60 mt-1 text-sm">
            Active sessions timeline + Generate Exit QR.
          </p>
        </div>

        <button
          onClick={fetchRows}
          disabled={loading}
          className="rounded-xl bg-white text-black px-6 py-3 font-semibold disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* QR Card */}
      {qrImg && (
        <div className="mb-6 w-[320px] rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold mb-2">Exit QR</div>
          <div className="rounded-xl bg-white p-3 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrImg} alt="Exit QR" className="w-[260px] h-[260px]" />
          </div>

          {qrUrl && (
            <div className="mt-3 text-xs text-white/50 break-all">{qrUrl}</div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-white/70">
            <tr className="border-b border-white/10">
              <th className="text-left p-3">Timestamp</th>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Phone</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Game</th>
              <th className="text-left p-3">Slot</th>
              <th className="text-left p-3">QR</th>
            </tr>
          </thead>

          <tbody>
            {tableRows.map((r) => {
              // ✅ BULLETPROOF: session is completed if:
              // - status not active OR
              // - any end marker exists OR
              // - exit_token is NULL (your consume route sets it null after scan)
              const sessionCompleted =
                (r.status && r.status !== "active") ||
                !!r.ended_at ||
                !!r.end_time ||
                !!r.ends_at ||
                r.exit_token === null;

              return (
                <tr key={r.id} className="border-b border-white/10">
                  <td className="p-3">{fmt(r.created_at)}</td>
                  <td className="p-3">{r.full_name || "-"}</td>
                  <td className="p-3">{r.phone || "-"}</td>
                  <td className="p-3">{r.email || "-"}</td>
                  <td className="p-3">{r.game_name || "-"}</td>

                  <td className="p-3">
                    {fmtTime(r.slot_start)} – {fmtTime(r.slot_end)}
                  </td>

                  <td className="p-3">
                    {sessionCompleted ? (
                      <span className="text-white/50 text-sm">
                        Session Completed
                      </span>
                    ) : (
                      <button
                        onClick={() => genQr(r.id)}
                        className="rounded-lg bg-blue-600 px-4 py-2 font-semibold hover:bg-blue-500"
                      >
                        Generate QR
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}

            {tableRows.length === 0 && (
              <tr>
                <td className="p-6 text-white/50" colSpan={7}>
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