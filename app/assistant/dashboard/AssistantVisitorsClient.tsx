"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useRouter } from "next/navigation";

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

  // legacy (keep)
  full_name: string | null;
  phone: string | null;
  email: string | null;

  // important
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

function dt(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}

function t(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isCompleted(r: Row) {
  return (r.status || "").toLowerCase() === "ended" || !!r.exit_time;
}

export default function AssistantVisitorsClient() {
  const router = useRouter();

  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");

  // ✅ Keep ONLY ONE QR per session (no duplicates)
  const [qrBySession, setQrBySession] = useState<Record<string, QrItem>>({});
  const [generating, setGenerating] = useState<Record<string, boolean>>({});

  const [endTarget, setEndTarget] = useState<Row | null>(null);
  const [ending, setEnding] = useState(false);
  const [endErr, setEndErr] = useState("");

  const makePeopleBlock = (r: Row) => {
    const people = Array.isArray(r.people) && r.people.length > 0 ? r.people : null;

    // fallback: single legacy fields
    if (!people) {
      return {
        names: [r.full_name || "-"],
        phones: [r.phone || "-"],
        emails: [r.email || "-"],
      };
    }

    return {
      names: people.map((p) => {
        const nm = p.full_name || "-";
        const emp = p.employee_id ? ` • ${p.employee_id}` : "";
        return `${nm}${emp}`;
      }),
      phones: people.map((p) => p.phone || "-"),
      emails: people.map((p) => p.email || "-"),
    };
  };

  const makeLabel = (r: Row) => {
    const block = makePeopleBlock(r);
    const namePart = block.names.join(" | ");

    return [
      namePart,
      r.game_name ? `• ${r.game_name}` : "",
      r.slot_start ? `• ${t(r.slot_start)}–${t(r.slot_end)}` : "",
      typeof r.players === "number" ? `• Players: ${r.players}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  };

  const load = async () => {
    setMsg("");
    try {
      const res = await fetch("/api/assistant/visitors", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        router.replace("/assistant/login");
        return;
      }

      if (!res.ok) {
        setMsg((data?.error || "Failed to load") + ` (HTTP ${res.status})`);
        return;
      }

      const newRows = (data.rows || []) as Row[];
      setRows(newRows);
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

  // ✅ Keep QR only for sessions that are still visible in this active list
  useEffect(() => {
    const activeIds = new Set(rows.map((r) => r.id));
    setQrBySession((prev) => {
      const next: Record<string, QrItem> = {};
      for (const [sid, item] of Object.entries(prev)) {
        if (activeIds.has(sid)) next[sid] = item;
      }
      return next;
    });
  }, [rows]);

  // ✅ If any row becomes completed (ended), remove its QR too
  const completedMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const r of rows) m.set(r.id, isCompleted(r));
    return m;
  }, [rows]);

  useEffect(() => {
    setQrBySession((prev) => {
      const next: Record<string, QrItem> = {};
      for (const [sid, item] of Object.entries(prev)) {
        if (!completedMap.get(sid)) next[sid] = item;
      }
      return next;
    });
  }, [completedMap]);

  const genQr = async (r: Row) => {
    const session_id = r.id;

    setMsg("");
    setGenerating((g) => ({ ...g, [session_id]: true }));

    try {
      const res = await fetch("/api/assistant/exit-code", {
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
        setMsg("exit_url missing from /api/assistant/exit-code response");
        return;
      }

      const dataUrl = await QRCode.toDataURL(exit_url, { width: 220, margin: 1 });

      const item: QrItem = {
        session_id,
        label: makeLabel(r),
        dataUrl,
        exit_url,
        generatedAt: new Date().toLocaleString(),
      };

      // ✅ Replace QR for this card only (fixed place)
      setQrBySession((prev) => ({ ...prev, [session_id]: item }));
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
      const res = await fetch("/api/assistant/visitors/end-session", {
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
      return true;
    } catch (e: any) {
      setEndErr(e?.message || "Failed to end session");
      return false;
    } finally {
      setEnding(false);
    }
  };

  const logout = async () => {
    await fetch("/api/assistant/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/assistant/login");
  };

  return (
    <main className="min-h-screen bg-black text-white px-4 py-8">
      {/* tablet friendly */}
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Assistant Panel</h1>
            <p className="text-white/60 text-sm">Visitors (Active only) • Limited access</p>
          </div>

          <button
            onClick={logout}
            className="rounded-xl bg-red-600 px-4 py-2 font-semibold hover:bg-red-500"
          >
            Logout
          </button>
        </div>

        {msg && <div className="text-red-300 text-sm">{msg}</div>}

        {/* ✅ Cards grid (note style) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const completed = isCompleted(r);
            const block = makePeopleBlock(r);
            const qr = qrBySession[r.id];

            return (
              <div
                key={r.id}
                className="
                  group relative overflow-hidden rounded-3xl
                  border border-white/10 bg-white/[0.04]
                  shadow-[0_0_0_1px_rgba(255,255,255,0.02)]
                  transition
                  hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]
                "
              >
                {/* top-right tiny meta */}
                <div className="absolute right-4 top-4">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                    {completed ? "Ended" : "Active"}
                  </span>
                </div>

                {/* Card content */}
                <div className="p-6 space-y-4">
                  {/* Title area like note */}
                  <div className="space-y-1 pr-20">
                    <div className="text-xs text-white/50">{dt(r.created_at)}</div>
                    <div className="text-lg font-semibold leading-tight">
                      {r.game_name || "Session"}
                    </div>
                    <div className="text-sm text-white/60">
                      {r.slot_start ? `${t(r.slot_start)} – ${t(r.slot_end)}` : "-"}
                      {typeof r.players === "number" ? ` • Players: ${r.players}` : ""}
                    </div>
                  </div>

                  {/* People block (like admin) */}
                  <div className="grid grid-cols-1 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-xs text-white/50 mb-1">Names</div>
                      <div className="space-y-1">
                        {block.names.map((x, idx) => (
                          <div key={idx} className="text-sm font-semibold text-white/90">
                            {x}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                        <div className="text-xs text-white/50 mb-1">Phone</div>
                        <div className="space-y-1">
                          {block.phones.map((x, idx) => (
                            <div key={idx} className="text-sm text-white/80">
                              {x}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                        <div className="text-xs text-white/50 mb-1">Email</div>
                        <div className="space-y-1">
                          {block.emails.map((x, idx) => (
                            <div key={idx} className="text-sm text-white/80 break-all">
                              {x}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* QR area (generated inside card) */}
                  {qr && !completed && (
                    <div className="relative rounded-2xl border border-white/10 bg-black/30 p-3">
                      {/* small cross */}
                      <button
                        onClick={() =>
                          setQrBySession((prev) => {
                            const next = { ...prev };
                            delete next[r.id];
                            return next;
                          })
                        }
                        className="absolute right-2 top-2 rounded-lg bg-white/10 px-2 py-1 text-xs text-white/70 hover:bg-white/15"
                        aria-label="Close QR"
                        title="Close"
                      >
                        ✕
                      </button>

                      <div className="text-xs text-white/50 pr-10">Exit QR</div>
                      <div className="mt-2 flex items-center justify-center">
                        <img src={qr.dataUrl} alt="Exit QR" className="rounded-xl" />
                      </div>
                      <div className="mt-2 text-[11px] text-white/40">
                        Generated: {qr.generatedAt}
                      </div>
                    </div>
                  )}

                  {/* Actions (bottom like Apply now) */}
                  <div className="pt-1 flex items-center justify-between gap-3">
                    <div className="text-xs text-white/40">
                      {completed ? "Completed" : "Ready"}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEndTarget(r)}
                        disabled={completed}
                        className="
                          rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold
                          hover:bg-white/15 disabled:opacity-40
                        "
                      >
                        End Session
                      </button>

                      <button
                        onClick={() => genQr(r)}
                        disabled={completed || !!generating[r.id]}
                        className="
                          rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold
                          hover:bg-blue-500 disabled:opacity-40
                        "
                      >
                        {generating[r.id] ? "Generating..." : qr ? "Re-generate QR" : "Generate QR"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* subtle hover sheen */}
                <div
                  className="
                    pointer-events-none absolute inset-0 opacity-0
                    group-hover:opacity-100 transition
                    bg-gradient-to-br from-white/10 via-transparent to-transparent
                  "
                />
              </div>
            );
          })}

          {rows.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-white/60">
              No active sessions found.
            </div>
          )}
        </div>

        {/* End session modal */}
        {endTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-lg font-semibold">End this session?</div>
                  <div className="text-sm text-white/60 mt-1">
                    This will end the session (only then it disappears from active views).
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

                    // remove QR immediately (UI)
                    setQrBySession((prev) => {
                      const next = { ...prev };
                      delete next[target.id];
                      return next;
                    });

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
      </div>
    </main>
  );
}