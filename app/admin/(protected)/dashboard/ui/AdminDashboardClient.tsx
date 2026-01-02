// ✅ FILE: app/admin/(protected)/dashboard/ui/AdminDashboardClient.tsx
// ✅ COPY-PASTE FULL FILE
// ✅ Shows MULTIPLE slot ranges in ONE ROW + ONE QR PER GROUP

"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type Slot = { start: string | null; end: string | null };

type Row = {
  id: string; // group row id
  group_id?: string | null;

  created_at: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;

  game_name: string | null;
  players: number | null;

  slot_start: string | null;
  slot_end: string | null;

  slots?: Slot[]; // ✅ new

  status: string | null;
  exit_time: string | null;
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

  const [qrs, setQrs] = useState<QrItem[]>([]);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});

  const load = async () => {
    setMsg("");
    try {
      const res = await fetch("/api/admin/sessions", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Failed to load");
        setRows([]);
        return;
      }
      setRows((data.rows || []) as Row[]);
    } catch {
      setMsg("Failed to load");
      setRows([]);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  // completed only when QR scanned (exit_time exists)
  const completedMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const r of rows) m.set(r.id, !!r.exit_time);
    return m;
  }, [rows]);

  useEffect(() => {
    setQrs((prev) => prev.filter((q) => !completedMap.get(q.group_id)));
  }, [completedMap]);

  const genQr = async (r: Row) => {
    const groupId = (r.group_id || r.id) as string;

    setMsg("");
    setGenerating((g) => ({ ...g, [groupId]: true }));

    try {
      const res = await fetch("/api/admin/exit-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: groupId }), // ✅ one QR per group
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Failed to generate QR");
        return;
      }

      const exit_url: string = data.exit_url;
      const dataUrl = await QRCode.toDataURL(exit_url, { width: 240, margin: 1 });

      const slotLabel =
        Array.isArray(r.slots) && r.slots.length
          ? r.slots
              .map((s) => `${t(s.start)}–${t(s.end)}`)
              .join(" | ")
          : r.slot_start
          ? `${t(r.slot_start)}–${t(r.slot_end)}`
          : "";

      const label = [
        r.full_name || "(No name)",
        r.email ? `• ${r.email}` : "",
        r.game_name ? `• ${r.game_name}` : "",
        slotLabel ? `• ${slotLabel}` : "",
        typeof r.players === "number" ? `• Players: ${r.players}` : "",
      ]
        .filter(Boolean)
        .join(" ");

      const item: QrItem = {
        group_id: groupId,
        label,
        dataUrl,
        exit_url,
        generatedAt: new Date().toLocaleString(),
      };

      setQrs((prev) => {
        const withoutThis = prev.filter((x) => x.group_id !== groupId);
        return [item, ...withoutThis];
      });
    } finally {
      setGenerating((g) => ({ ...g, [groupId]: false }));
    }
  };

  return (
    <div className="text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Visitors</h1>
          <p className="text-white/60 text-sm">Active sessions timeline + Generate Exit QR.</p>
        </div>
      </div>

      {msg && <div className="mt-3 text-red-300 text-sm">{msg}</div>}

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
              <th className="p-3 text-left">Slot(s)</th>
              <th className="p-3 text-left">Exit Time</th>
              <th className="p-3 text-left">QR</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const completed = !!r.exit_time;
              const groupId = (r.group_id || r.id) as string;

              return (
                <tr key={r.id} className="border-t border-white/10 hover:bg-white/5 align-top">
                  <td className="p-3">{dt(r.created_at)}</td>
                  <td className="p-3">{r.full_name || "-"}</td>
                  <td className="p-3">{r.phone || "-"}</td>
                  <td className="p-3">{r.email || "-"}</td>
                  <td className="p-3">{r.game_name || "-"}</td>
                  <td className="p-3">{typeof r.players === "number" ? r.players : "-"}</td>

                  {/* ✅ MULTI SLOTS IN SAME UI ROW */}
                  <td className="p-3">
                    {Array.isArray(r.slots) && r.slots.length ? (
                      <div className="space-y-1">
                        {r.slots.map((s, i) => (
                          <div key={i} className="text-white/90">
                            {t(s.start)} – {t(s.end)}
                          </div>
                        ))}
                      </div>
                    ) : r.slot_start ? (
                      `${t(r.slot_start)} – ${t(r.slot_end)}`
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
                        disabled={!!generating[groupId]}
                        className="rounded-lg bg-blue-600 px-3 py-2 font-semibold hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {generating[groupId] ? "Generating..." : "Generate QR"}
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