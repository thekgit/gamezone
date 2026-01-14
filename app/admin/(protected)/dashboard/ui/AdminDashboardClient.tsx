"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import AparUsersClient from "../../../(panel)/ui/AparUsersClient";

type Person = {
  user_id: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  employee_id?: string | null;
};

type Row = {
  id: string;
  created_at: string;

  full_name: string | null;
  phone: string | null;
  email: string | null;

  people?: Person[]; // ✅ NEW

  game_name: string | null;
  players: number | null;

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
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminDashboardClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");

  const [qrs, setQrs] = useState<QrItem[]>([]);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});

  const [endTarget, setEndTarget] = useState<Row | null>(null);
  const [ending, setEnding] = useState(false);
  const [endErr, setEndErr] = useState("");

  // ✅ NEW: Delete popup state
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  const load = async () => {
    setMsg("");
    try {
      const res = await fetch("/api/admin/visitors", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg((data?.error || "Failed to load") + ` (HTTP ${res.status})`);
        return;
      }
      setRows((data.rows || []) as Row[]);
    } catch {
      setMsg("Failed to load");
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  const completedMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const r of rows) {
      const completed =
        (r.status || "").toLowerCase() === "ended" || !!r.exit_time;
      m.set(r.id, completed);
    }
    return m;
  }, [rows]);

  useEffect(() => {
    setQrs((prev) => prev.filter((q) => !completedMap.get(q.session_id)));
  }, [completedMap]);

  // ✅ Generate QR (unchanged)
  const genQr = async (r: Row) => {
    const session_id = r.id;

    setMsg("");
    setGenerating((g) => ({ ...g, [session_id]: true }));

    try {
      const res = await fetch("/api/admin/exit-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ session_id }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg((data?.error || "Failed to generate QR") + ` (HTTP ${res.status})`);
        return;
      }

      const exit_url: string | undefined = data?.exit_url;
      if (!exit_url || typeof exit_url !== "string") {
        setMsg("exit_url missing from /api/admin/exit-code response");
        return;
      }

      const dataUrl = await QRCode.toDataURL(exit_url, { width: 240, margin: 1 });

      const label = [
        r.full_name || "(No name)",
        r.email ? `• ${r.email}` : "",
        r.game_name ? `• ${r.game_name}` : "",
        r.slot_start ? `• ${t(r.slot_start)}–${t(r.slot_end)}` : "",
        typeof r.players === "number" ? `• Players: ${r.players}` : "",
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

      setQrs((prev) => {
        const withoutThis = prev.filter((x) => x.session_id !== session_id);
        return [item, ...withoutThis];
      });
    } catch (e: any) {
      setMsg(`Generate QR failed: ${e?.message || "Unknown error"}`);
    } finally {
      setGenerating((g) => ({ ...g, [session_id]: false }));
    }
  };

  // ✅ End Session (your existing behavior)
  const endSession = async (r: Row) => {
    setEndErr("");
    setEnding(true);
    try {
      const res = await fetch("/api/admin/visitors/end-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          session_id: r.id,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEndErr(data?.error || "Failed to end session");
        return false;
      }
      return true;
    } catch (e: any) {
      setEndErr(e?.message || "Failed to end session");
      return false;
    } finally {
      setEnding(false);
    }
  };

  // ✅ NEW: Delete Entry (ONLY sessions row)
  const deleteEntry = async (r: Row) => {
    setDeleteErr("");
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/visitors/delete-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ session_id: r.id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteErr(data?.error || "Failed to delete entry");
        return false;
      }
      return true;
    } catch (e: any) {
      setDeleteErr(e?.message || "Failed to delete entry");
      return false;
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="text-white space-y-6">
      <AparUsersClient />

      <div>
        <h1 className="text-2xl font-bold">Visitors</h1>
        <p className="text-white/60 text-sm">
          Active sessions timeline + Generate Exit QR.
        </p>
      </div>

      {msg && <div className="text-red-300 text-sm">{msg}</div>}

      {/* ✅ QR PANEL (unchanged) */}
      {qrs.length > 0 && (
        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="font-semibold mb-3">Active Exit QRs</div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {qrs.map((q) => (
              <div
                key={q.session_id}
                className="rounded-xl border border-white/10 bg-black/30 p-3"
              >
                <div className="text-sm font-semibold">{q.label}</div>
                <div className="text-xs text-white/50 mt-1">
                  Generated: {q.generatedAt}
                </div>

                <div className="mt-3 flex justify-center">
                  <img src={q.dataUrl} alt="Exit QR" className="rounded-lg" />
                </div>

                <div className="mt-2 text-xs text-white/40 break-all">
                  Session: {q.session_id}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TABLE */}
      <div className="overflow-auto rounded-xl border border-white/10 bg-[#0b0b0b]">
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
              <th className="p-3 text-left">End Session</th>

              {/* ✅ NEW COLUMN */}
              

              <th className="p-3 text-left">QR</th>
              <th className="p-3 text-left">Entry</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const completed =
                (r.status || "").toLowerCase() === "ended" || !!r.exit_time;

              return (
                <tr key={r.id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="p-3">{dt(r.created_at)}</td>
                  <td className="p-3">
                    {Array.isArray(r.people) && r.people.length > 0 ? (
                      <div className="space-y-1">
                        {r.people.map((p, i) => (
                          <div key={(p.user_id || "x") + i} className="text-sm">
                            <div className="font-semibold">{p.full_name || "-"}</div>
                            {p.employee_id ? (
                              <div className="text-xs text-white/50">{p.employee_id}</div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      r.full_name || "-"
                    )}
                  </td>

                  <td className="p-3">
                    {Array.isArray(r.people) && r.people.length > 0 ? (
                      <div className="space-y-1">
                        {r.people.map((p, i) => (
                          <div key={(p.user_id || "x") + "ph" + i} className="text-sm">
                            {p.phone || "-"}
                          </div>
                        ))}
                      </div>
                    ) : (
                      r.phone || "-"
                    )}
                  </td>

                  <td className="p-3">
                    {Array.isArray(r.people) && r.people.length > 0 ? (
                      <div className="space-y-1">
                        {r.people.map((p, i) => (
                          <div key={(p.user_id || "x") + "em" + i} className="text-sm">
                            {p.email || "-"}
                          </div>
                        ))}
                      </div>
                    ) : (
                      r.email || "-"
                    )}
                  </td>
                  <td className="p-3">{r.game_name || "-"}</td>
                  <td className="p-3">{r.players ?? "-"}</td>
                  <td className="p-3">
                    {r.slot_start ? `${t(r.slot_start)} – ${t(r.slot_end)}` : "-"}
                  </td>
                  <td className="p-3">{t(r.exit_time)}</td>

                  <td className="p-3">
                    {completed ? (
                      <span className="text-green-400 font-semibold">Completed</span>
                    ) : (
                      <button
                        onClick={() => setEndTarget(r)}
                        className="rounded-lg bg-white/10 px-3 py-2 font-semibold hover:bg-white/15"
                      >
                        End Session
                      </button>
                    )}
                  </td>

                  {/* ✅ NEW: Entry column delete */}
                  

                  <td className="p-3">
                    {completed ? (
                      <span className="text-green-400 font-semibold">Session Completed</span>
                    ) : (
                      <button
                        onClick={() => genQr(r)}
                        disabled={!!generating[r.id]}
                        className="rounded-lg bg-blue-600 px-3 py-2 font-semibold hover:bg-blue-500 disabled:opacity-40"
                      >
                        {generating[r.id] ? "Generating..." : "Generate QR"}
                      </button>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => setDeleteTarget(r)}
                      className="rounded-lg bg-red-600 px-3 py-2 font-semibold hover:bg-red-500"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td className="p-4 text-white/60" colSpan={11}>
                  No sessions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* END SESSION MODAL (unchanged) */}
      {endTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 text-white">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-lg font-semibold">End this session?</div>
                <div className="text-sm text-white/60 mt-1">
                  If slot time is already passed, exit time will be slot end. Otherwise exit time will be now.
                </div>
              </div>
              <button onClick={() => setEndTarget(null)}>✕</button>
            </div>

            {endErr && <div className="mt-3 text-red-300 text-sm">{endErr}</div>}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setEndTarget(null)}
                className="flex-1 rounded-xl bg-white/10 py-2.5 font-semibold"
                disabled={ending}
              >
                No
              </button>

              <button
                onClick={async () => {
                  const target = endTarget;
                  if (!target) return;

                  const ok = await endSession(target);
                  if (!ok) return;

                  setEndTarget(null);
                  await load();
                }}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 font-semibold disabled:opacity-50"
                disabled={ending}
              >
                {ending ? "Ending..." : "Yes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ NEW: DELETE CONFIRM MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 text-white">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-lg font-semibold">Do you want to delete this entry?</div>
                <div className="text-sm text-white/60 mt-1">
                  This will permanently remove ONLY this entry row from the database.
                </div>
              </div>
              <button onClick={() => setDeleteTarget(null)}>✕</button>
            </div>

            {deleteErr && <div className="mt-3 text-red-300 text-sm">{deleteErr}</div>}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl bg-white/10 py-2.5 font-semibold"
                disabled={deleting}
              >
                No
              </button>

              <button
                onClick={async () => {
                  const target = deleteTarget;
                  if (!target) return;

                  const ok = await deleteEntry(target);
                  if (!ok) return;

                  setDeleteTarget(null);

                  // ✅ Remove from UI instantly (fast) + refresh (safe)
                  setRows((prev) => prev.filter((x) => x.id !== target.id));
                  setQrs((prev) => prev.filter((q) => q.session_id !== target.id));
                  await load();
                }}
                className="flex-1 rounded-xl bg-red-600 py-2.5 font-semibold hover:bg-red-500 disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Yes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}