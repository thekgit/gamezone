"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import AparUsersClient from "../../../(panel)/ui/AparUsersClient";

type RowPerson = {
  user_id: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  employee_id: string | null;
};

type Row = {
  id: string;
  created_at: string;

  full_name: string | null;
  phone: string | null;
  email: string | null;

  people?: RowPerson[];

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

function safeLower(v: any) {
  return String(v ?? "").toLowerCase();
}
function dt(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}
function t(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AdminDashboardClient() {
  // ----------------------------
  // Core data
  // ----------------------------
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");

  // ----------------------------
  // Search (NEW)
  // ----------------------------
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    const hit = (v: any) => safeLower(v).includes(q);

    return rows.filter((r) => {
      // search in people[] first
      if (Array.isArray(r.people) && r.people.length > 0) {
        return r.people.some((p) => hit(p.full_name) || hit(p.employee_id) || hit(p.email) || hit(p.phone));
      }
      // fallback legacy fields
      return hit(r.full_name) || hit(r.email) || hit(r.phone);
    });
  }, [rows, search]);

  // ----------------------------
  // QR state
  // ----------------------------
  const [qrs, setQrs] = useState<QrItem[]>([]);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});

  // ----------------------------
  // End session modal state
  // ----------------------------
  const [endTarget, setEndTarget] = useState<Row | null>(null);
  const [ending, setEnding] = useState(false);
  const [endErr, setEndErr] = useState("");

  // ----------------------------
  // Delete modal state
  // ----------------------------
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  // ----------------------------
  // Load data
  // ----------------------------
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

      const next = (data.rows || []) as Row[];
      setRows(next);
    } catch {
      setMsg("Failed to load");
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------
  // Derived maps
  // ----------------------------
  const completedMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const r of rows) {
      const completed = safeLower(r.status) === "ended" || !!r.exit_time;
      m.set(r.id, completed);
    }
    return m;
  }, [rows]);

  // remove QR cards when session completes
  useEffect(() => {
    setQrs((prev) => prev.filter((q) => !completedMap.get(q.session_id)));
  }, [completedMap]);

  // ----------------------------
  // Helpers
  // ----------------------------
  const buildLabel = (r: Row) => {
    const namePart =
      Array.isArray(r.people) && r.people.length > 0
        ? r.people
            .map((p) => {
              const nm = p.full_name || "(No name)";
              const emp = p.employee_id ? ` • ${p.employee_id}` : "";
              return `${nm}${emp}`;
            })
            .join(" | ")
        : r.full_name || "(No name)";

    return [
      namePart,
      r.email ? `• ${r.email}` : "",
      r.game_name ? `• ${r.game_name}` : "",
      r.slot_start ? `• ${t(r.slot_start)}–${t(r.slot_end)}` : "",
      typeof r.players === "number" ? `• Players: ${r.players}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  };

  // ----------------------------
  // Actions
  // ----------------------------
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

      const item: QrItem = {
        session_id,
        label: buildLabel(r),
        dataUrl,
        exit_url,
        generatedAt: new Date().toLocaleString(),
      };

      // ✅ Replace QR for same session (prevents duplicates)
      setQrs((prev) => {
        const without = prev.filter((x) => x.session_id !== session_id);
        return [item, ...without];
      });
    } catch (e: any) {
      setMsg(`Generate QR failed: ${e?.message || "Unknown error"}`);
    } finally {
      setGenerating((g) => ({ ...g, [session_id]: false }));
    }
  };

  const endSession = async (r: Row) => {
    setEndErr("");
    setEnding(true);
    try {
      const res = await fetch("/api/admin/visitors/end-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ session_id: r.id }),
      });
  
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEndErr(data?.error || "Failed to end session");
        return false;
      }
  
      // ✅ FORCE UI to display the click time returned by server
      const clickTime = data?.closed_at_after || data?.ended_at_after || data?.clickedAt || new Date().toISOString();
  
      setRows((prev) =>
        prev.map((x) =>
          x.id === r.id
            ? { ...x, status: "ended", exit_time: clickTime }
            : x
        )
      );
  
      // also remove QR if exists
      setQrs((prev) => prev.filter((q) => q.session_id !== r.id));
  
      return true;
    } catch (e: any) {
      setEndErr(e?.message || "Failed to end session");
      return false;
    } finally {
      setEnding(false);
    }
  };

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

      // ✅ immediate UI cleanup
      setRows((prev) => prev.filter((x) => x.id !== r.id));
      setQrs((prev) => prev.filter((q) => q.session_id !== r.id));
      return true;
    } catch (e: any) {
      setDeleteErr(e?.message || "Failed to delete entry");
      return false;
    } finally {
      setDeleting(false);
    }
  };

  // ----------------------------
  // Render
  // ----------------------------
  return (
    <div className="text-white space-y-6">
      <AparUsersClient />

      <div>
        <h1 className="text-2xl font-bold">Visitors</h1>
        <p className="text-white/60 text-sm">Active sessions timeline + Generate Exit QR.</p>
      </div>

      {/* Search bar */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, employee id, email or phone..."
          className="w-full rounded-lg bg-black/40 border border-white/10 px-4 py-2 text-white outline-none focus:border-white/30"
        />
      </div>

      {msg && <div className="text-red-300 text-sm">{msg}</div>}

      {/* QR PANEL */}
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
              <th className="p-3 text-left">QR</th>
              <th className="p-3 text-left">Entry</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((r) => {
              const completed = safeLower(r.status) === "ended" || !!r.exit_time;

              return (
                <tr key={r.id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="p-3">{dt(r.created_at)}</td>

                  {/* Name list */}
                  <td className="p-3">
                    {Array.isArray(r.people) && r.people.length > 0 ? (
                      <div className="space-y-2">
                        {r.people.map((p, idx) => (
                          <div key={(p.user_id || "") + "_" + idx} className="leading-snug">
                            <div className="font-semibold">
                              {p.full_name || "-"}
                              {p.employee_id ? (
                                <span className="text-white/50 font-normal"> • {p.employee_id}</span>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      r.full_name || "-"
                    )}
                  </td>

                  {/* Phone list */}
                  <td className="p-3">
                    {Array.isArray(r.people) && r.people.length > 0 ? (
                      <div className="space-y-2">
                        {r.people.map((p, idx) => (
                          <div key={(p.user_id || "") + "_ph_" + idx} className="text-white/80">
                            {p.phone || "-"}
                          </div>
                        ))}
                      </div>
                    ) : (
                      r.phone || "-"
                    )}
                  </td>

                  {/* Email list */}
                  <td className="p-3">
                    {Array.isArray(r.people) && r.people.length > 0 ? (
                      <div className="space-y-2">
                        {r.people.map((p, idx) => (
                          <div key={(p.user_id || "") + "_em_" + idx} className="text-white/80 break-all">
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
                  <td className="p-3">{r.slot_start ? `${t(r.slot_start)} – ${t(r.slot_end)}` : "-"}</td>
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

            {filteredRows.length === 0 && (
              <tr>
                <td className="p-4 text-white/60" colSpan={11}>
                  No sessions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* END SESSION MODAL */}
      {endTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 text-white">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-lg font-semibold">End this session?</div>
                <div className="text-sm text-white/60 mt-1">
                  Exit time should be the click time (handled in your API).
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

      {/* DELETE CONFIRM MODAL */}
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