"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type Segment = {
  session_id: string;
  game_name: string | null;
  slot_start: string | null;
  slot_end: string | null;
  ended_at: string | null;
  status: string | null;
};

type Row = {
  // IMPORTANT: id is group_id now
  id: string;
  group_id: string;

  created_at: string;

  full_name: string | null;
  phone: string | null;
  email: string | null;

  players: number | null;

  // ✅ combined display name (like "Pickle Ball (+1)")
  game_name: string | null;

  // ✅ multiple sessions in one row
  segments: Segment[];

  status: string | null;   // "active" or "ended"
  exit_time: string | null; // latest ended_at
};

type QrItem = {
  group_id: string;
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

  // multi QR board (one QR per GROUP)
  const [qrs, setQrs] = useState<QrItem[]>([]);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});

  const load = async () => {
    setMsg("");
    try {
      // ✅ your backend must return grouped rows with segments[]
      const res = await fetch("/api/admin/visitors", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Failed to load");
        return;
      }
      setRows((data.rows || []) as Row[]);
    } catch {
      setMsg("Failed to load");
    }
  };

  // auto-refresh
  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  // completed groups map
  const completedMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const r of rows) {
      const completed =
        (r.status || "").toLowerCase() === "ended" ||
        (!!r.exit_time && r.exit_time !== null);
      m.set(r.group_id, completed);
    }
    return m;
  }, [rows]);

  // remove QR cards once group completes
  useEffect(() => {
    setQrs((prev) => prev.filter((q) => !completedMap.get(q.group_id)));
  }, [completedMap]);

  const genQr = async (r: Row) => {
    const group_id = r.group_id;

    setMsg("");
    setGenerating((g) => ({ ...g, [group_id]: true }));

    try {
      // ✅ MUST accept group_id (not session_id)
      const res = await fetch("/api/admin/exit-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Failed to generate QR");
        return;
      }

      const exit_url: string = data.exit_url;
      const dataUrl = await QRCode.toDataURL(exit_url, { width: 240, margin: 1 });

      const firstSeg = r.segments?.[0];
      const label = [
        r.full_name || "(No name)",
        r.email ? `• ${r.email}` : "",
        r.game_name ? `• ${r.game_name}` : "",
        firstSeg?.slot_start ? `• ${t(firstSeg.slot_start)}–${t(firstSeg.slot_end)}` : "",
        typeof r.players === "number" ? `• Players: ${r.players}` : "",
      ]
        .filter(Boolean)
        .join(" ");

      const item: QrItem = {
        group_id,
        label,
        dataUrl,
        exit_url,
        generatedAt: new Date().toLocaleString(),
      };

      setQrs((prev) => {
        const without = prev.filter((x) => x.group_id !== group_id);
        return [item, ...without];
      });
    } finally {
      setGenerating((g) => ({ ...g, [group_id]: false }));
    }
  };

  return (
    <div className="text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Visitors</h1>
          <p className="text-white/60 text-sm">Grouped sessions + Generate ONE Exit QR per group.</p>
        </div>
      </div>

      {msg && <div className="mt-3 text-red-300 text-sm">{msg}</div>}

      {/* QR board */}
      {qrs.length > 0 && (
        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="font-semibold mb-3">Active Exit QRs</div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {qrs.map((q) => (
              <div key={q.group_id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="text-sm font-semibold">{q.label}</div>
                <div className="text-xs text-white/50 mt-1">Generated: {q.generatedAt}</div>

                <div className="mt-3 flex justify-center">
                  <img src={q.dataUrl} alt="Exit QR" className="rounded-lg" />
                </div>

                <div className="mt-2 text-xs text-white/40 break-all">Group: {q.group_id}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* table */}
      <div className="mt-6 overflow-auto rounded-xl border border-white/10 bg-[#0b0b0b]">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="p-3 text-left">Timestamp</th>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Phone</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Game</th>
              <th className="p-3 text-left">Players</th>
              <th className="p-3 text-left">Slot</th>
              <th className="p-3 text-left">Exit Time</th>
              <th className="p-3 text-left">QR</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const completed = !!r.exit_time; // ✅ completed only after QR scan

              return (
                <tr key={r.group_id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="p-3">{dt(r.created_at)}</td>
                  <td className="p-3">{r.full_name || "-"}</td>
                  <td className="p-3">{r.phone || "-"}</td>
                  <td className="p-3">{r.email || "-"}</td>
                  <td className="p-3">{r.game_name || "-"}</td>
                  <td className="p-3">{typeof r.players === "number" ? r.players : "-"}</td>

                  {/* ✅ MULTILINE Slot list */}
                  <td className="p-3">
                    {r.segments?.length ? (
                      <div className="space-y-1">
                        {r.segments.map((seg, idx) => (
                          <div key={seg.session_id} className="text-white/90">
                            <span className="text-white/60 mr-2">#{idx + 1}</span>
                            <span className="font-medium">{seg.game_name || "-"}</span>
                            <span className="text-white/60 ml-2">
                              {seg.slot_start ? `${t(seg.slot_start)} – ${t(seg.slot_end)}` : "-"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td className="p-3">{t(r.exit_time)}</td>

                  <td className="p-3">
                    {completed ? (
                      <span className="text-green-400 font-semibold">Session Completed</span>
                    ) : (
                      <button
                        onClick={() => genQr(r)}
                        disabled={!!generating[r.group_id]}
                        className="rounded-lg bg-blue-600 px-3 py-2 font-semibold hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {generating[r.group_id] ? "Generating..." : "Generate QR"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td className="p-4 text-white/60" colSpan={9}>
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