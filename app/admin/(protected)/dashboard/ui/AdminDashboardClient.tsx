"use client";

import { useEffect, useMemo, useState } from "react";
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
  exit_time: string | null;
};

type QrItem = {
  session_id: string;
  label: string;
  dataUrl: string;
  exit_url: string;
  generatedAt: string;
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

  // multi QR storage
  const [qrs, setQrs] = useState<QrItem[]>([]);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});

  const load = async () => {
    setMsg("");
    try {
      const res = await fetch("/api/admin/sessions", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Failed to load");
        return;
      }
      setRows(data.rows || []);
    } catch {
      setMsg("Failed to load");
    }
  };

  // auto-refresh every 5 seconds
  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  // map completed sessions
  const completedMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const r of rows) {
      const completed = (r.status || "").toLowerCase() === "ended" || !!r.exit_time;
      m.set(r.id, completed);
    }
    return m;
  }, [rows]);

  // remove QR cards once session completes
  useEffect(() => {
    setQrs((prev) => prev.filter((q) => !completedMap.get(q.session_id)));
  }, [completedMap]);

  const genQr = async (r: Row) => {
    const session_id = r.id;

    setMsg("");
    setGenerating((g) => ({ ...g, [session_id]: true }));

    try {
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

      const exit_url: string = data.exit_url;
      const dataUrl = await QRCode.toDataURL(exit_url, { width: 240, margin: 1 });

      const label = [
        r.full_name || "(No name)",
        r.email ? `• ${r.email}` : "",
        r.game_name ? `• ${r.game_name}` : "",
        r.slot_start ? `• ${t(r.slot_start)}–${t(r.slot_end)}` : "",
      ]
        .filter(Boolean)
        .join(" ");

      const item: QrItem = {
        session_id,
        label,
        dataUrl,
        exit_url,
        generatedAt: new Date().toLocaleString(),
      };

      // keep multiple QRs; replace existing for same session
      setQrs((prev) => {
        const withoutThis = prev.filter((x) => x.session_id !== session_id);
        return [item, ...withoutThis];
      });
    } finally {
      setGenerating((g) => ({ ...g, [session_id]: false }));
    }
  };

  const clearAllQrs = () => setQrs([]);

  return (
    <div className="text-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Visitors</h1>
          <p className="text-white/60 text-sm">Active sessions timeline + Generate Exit QR.</p>
        </div>

        <button
          onClick={clearAllQrs}
          className="rounded-lg bg-white/10 px-4 py-2 font-semibold hover:bg-white/15"
        >
        
        </button>
      </div>

      {msg && <div className="mt-3 text-red-300 text-sm">{msg}</div>}

      {/* MULTI-QR BOARD */}
      {qrs.length > 0 && (
        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="font-semibold mb-3">Active Exit QRs</div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {qrs.map((q) => (
              <div key={q.session_id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="text-sm font-semibold">{q.label}</div>
                <div className="text-xs text-white/50 mt-1">Generated: {q.generatedAt}</div>

                <div className="mt-3 flex justify-center">
                  <img src={q.dataUrl} alt="Exit QR" className="rounded-lg" />
                </div>

                <div className="mt-2 text-xs text-white/40 break-all">Session: {q.session_id}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TABLE */}
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
              <th className="p-3 text-left">Exit Time</th>
              <th className="p-3 text-left">QR</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const completed = (r.status || "").toLowerCase() === "ended" || !!r.exit_time;

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
                  <td className="p-3">{t(r.exit_time)}</td>

                  <td className="p-3">
                    {completed ? (
                      <span className="text-green-400 font-semibold">Session Completed</span>
                    ) : (
                      <button
                        onClick={() => genQr(r)}
                        disabled={!!generating[r.id]}
                        className="rounded-lg bg-blue-600 px-3 py-2 font-semibold hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {generating[r.id] ? "Generating..." : "Generate QR"}
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