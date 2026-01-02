// app/admin/(protected)/dashboard/ui/AdminDashboardClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type AnyRow = any;

type Row = {
  // ✅ group row key (we will use group_id if present)
  id: string;

  created_at: string | null;

  full_name: string | null;
  phone: string | null;
  email: string | null;

  game_name: string | null;
  players: number | null;

  // ✅ show ALL segments in same row
  segments: { start: string | null; end: string | null; game_name: string | null }[];

  // ✅ group completion time (QR scan time)
  exit_time: string | null;

  // group id
  group_id: string | null;

  // underlying session ids (for debug / future use)
  session_ids: string[];
};

type QrItem = {
  group_key: string; // group_id OR id
  label: string;
  dataUrl: string;
  exit_url: string;
  generatedAt: string;
};

// ---------- formatting helpers ----------
function dt(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}

function t(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function normalizeSession(r: AnyRow) {
  const created_at = r.created_at ?? r.timestamp ?? null;

  const full_name = r.full_name ?? r.name ?? r.visitor_name ?? null;
  const phone = r.phone ?? r.visitor_phone ?? null;
  const email = r.email ?? r.visitor_email ?? null;

  const game_name = r.game_name ?? r.game ?? null;

  const players =
    typeof r.players === "number" ? r.players : r.players != null ? Number(r.players) : null;

  const slot_start = r.slot_start ?? r.start_time ?? r.started_at ?? null;
  const slot_end = r.slot_end ?? r.end_time ?? r.ends_at ?? null;

  const status = r.status ?? null;

  // ✅ exit_time must be QR scan time (ended_at)
  const exit_time = r.exit_time ?? r.ended_at ?? null;

  const group_id = r.group_id ?? null;

  return {
    id: String(r.id),
    created_at,
    full_name,
    phone,
    email,
    game_name,
    players,
    slot_start,
    slot_end,
    status,
    exit_time,
    group_id,
  };
}

// ✅ group sessions by group_id; show multiple sessions inside ONE table row
function groupRows(rawRows: AnyRow[]): Row[] {
  const sessions = rawRows.map(normalizeSession);

  // groupKey = group_id if present else session id
  const byGroup = new Map<string, ReturnType<typeof normalizeSession>[]>();

  for (const s of sessions) {
    const key = s.group_id || s.id;
    const arr = byGroup.get(key) || [];
    arr.push(s);
    byGroup.set(key, arr);
  }

  const grouped: Row[] = [];

  for (const [groupKey, arr] of byGroup.entries()) {
    // sort oldest -> newest inside group
    arr.sort((a, b) => {
      const ta = new Date(a.slot_start || a.created_at || 0).getTime();
      const tb = new Date(b.slot_start || b.created_at || 0).getTime();
      return ta - tb;
    });

    const first = arr[0];
    const last = arr[arr.length - 1];

    const segments = arr.map((s) => ({
      start: s.slot_start,
      end: s.slot_end,
      game_name: s.game_name,
    }));

    // ✅ group completed ONLY when ANY session has ended_at (QR scan time)
    const exit_time = arr.map((s) => s.exit_time).find(Boolean) ?? null;

    // players: keep from first (should be same across group)
    const players = first.players ?? null;

    // title game_name: if single game show it, else show "Multiple"
    const uniqGames = Array.from(new Set(arr.map((x) => x.game_name).filter(Boolean)));
    const game_name = uniqGames.length === 1 ? (uniqGames[0] as string) : "Multiple";

    grouped.push({
      id: groupKey,
      group_id: first.group_id || null,
      created_at: first.created_at ?? null,
      full_name: first.full_name ?? null,
      phone: first.phone ?? null,
      email: first.email ?? null,
      game_name,
      players,
      segments,
      exit_time,
      session_ids: arr.map((x) => x.id),
    });
  }

  // newest groups first (by created_at)
  grouped.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  return grouped;
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

      const raw = Array.isArray(data?.rows) ? data.rows : [];
      const grouped = groupRows(raw);
      setRows(grouped);
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

  // ✅ completed per group (QR scanned)
  const completedMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const r of rows) m.set(r.id, !!r.exit_time);
    return m;
  }, [rows]);

  // remove QR cards once group completes
  useEffect(() => {
    setQrs((prev) => prev.filter((q) => !completedMap.get(q.group_key)));
  }, [completedMap]);

  // ✅ Generate ONE QR per group_id
  const genQr = async (r: Row) => {
    const group_key = r.id;

    setMsg("");
    setGenerating((g) => ({ ...g, [group_key]: true }));

    try {
      const res = await fetch("/api/admin/exit-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ✅ preferred: group_id, fallback: session_id
        body: JSON.stringify({
          group_id: r.group_id || r.id,
          session_id: r.session_ids?.[0] || r.id,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Failed to generate QR");
        return;
      }

      const exit_url: string = data.exit_url;
      const dataUrl = await QRCode.toDataURL(exit_url, { width: 240, margin: 1 });

      // create a readable segments label
      const segLabel = r.segments
        .map((s, i) => {
          const gname = s.game_name || "Game";
          return `${i + 1}) ${gname} ${t(s.start)}–${t(s.end)}`;
        })
        .join("  |  ");

      const label = [
        r.full_name || "(No name)",
        r.email ? `• ${r.email}` : "",
        typeof r.players === "number" ? `• Players: ${r.players}` : "",
        segLabel ? `• ${segLabel}` : "",
      ]
        .filter(Boolean)
        .join(" ");

      const item: QrItem = {
        group_key,
        label,
        dataUrl,
        exit_url,
        generatedAt: new Date().toLocaleString(),
      };

      setQrs((prev) => {
        const withoutThis = prev.filter((x) => x.group_key !== group_key);
        return [item, ...withoutThis];
      });
    } finally {
      setGenerating((g) => ({ ...g, [group_key]: false }));
    }
  };

  return (
    <div className="text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Visitors</h1>
          <p className="text-white/60 text-sm">Grouped sessions timeline + Generate ONE Exit QR per group.</p>
        </div>
      </div>

      {msg && <div className="mt-3 text-red-300 text-sm">{msg}</div>}

      {qrs.length > 0 && (
        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="font-semibold mb-3">Active Exit QRs</div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {qrs.map((q) => (
              <div key={q.group_key} className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="text-sm font-semibold">{q.label}</div>
                <div className="text-xs text-white/50 mt-1">Generated: {q.generatedAt}</div>

                <div className="mt-3 flex justify-center">
                  <img src={q.dataUrl} alt="Exit QR" className="rounded-lg" />
                </div>
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
              <th className="p-3 text-left">Players</th>
              <th className="p-3 text-left">Slot(s)</th>
              <th className="p-3 text-left">Exit Time</th>
              <th className="p-3 text-left">QR</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const completed = !!r.exit_time;

              return (
                <tr key={r.id} className="border-t border-white/10 hover:bg-white/5 align-top">
                  <td className="p-3">{dt(r.created_at)}</td>
                  <td className="p-3">{r.full_name || "-"}</td>
                  <td className="p-3">{r.phone || "-"}</td>
                  <td className="p-3">{r.email || "-"}</td>
                  <td className="p-3">{typeof r.players === "number" ? r.players : "-"}</td>

                  {/* ✅ multiple segments in same cell */}
                  <td className="p-3">
                    {r.segments.length ? (
                      <div className="flex flex-col gap-1">
                        {r.segments.map((s, i) => (
                          <div key={i} className="text-xs text-white/90">
                            <span className="text-white/60">{i + 1}.</span>{" "}
                            <span className="font-semibold">{s.game_name || "-"}</span>{" "}
                            <span className="text-white/70">
                              {s.start ? `${t(s.start)} – ${t(s.end)}` : "-"}
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