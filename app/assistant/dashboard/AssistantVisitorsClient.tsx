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

function dt(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}
function t(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ---- stable "random" from a string (session_id) ----
function hashToInt(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}
function pick<T>(arr: T[], idx: number) {
  return arr[idx % arr.length];
}

export default function AssistantVisitorsClient() {
  const router = useRouter();

  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");

  const [qrs, setQrs] = useState<QrItem[]>([]);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});

  const [endTarget, setEndTarget] = useState<Row | null>(null);
  const [ending, setEnding] = useState(false);
  const [endErr, setEndErr] = useState("");

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
      setRows((data.rows || []) as Row[]);
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

  const completedMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const r of rows) {
      const completed = (r.status || "").toLowerCase() === "ended" || !!r.exit_time;
      m.set(r.id, completed);
    }
    return m;
  }, [rows]);

  // assistant API returns ONLY active -> remove QR cards that are no longer in rows
  useEffect(() => {
    const activeIds = new Set(rows.map((r) => r.id));
    setQrs((prev) => prev.filter((q) => activeIds.has(q.session_id)));
  }, [rows]);

  // remove QRs for completed sessions (extra safety)
  useEffect(() => {
    setQrs((prev) => prev.filter((q) => !completedMap.get(q.session_id)));
  }, [completedMap]);

  const makeLabel = (r: Row) => {
    const namePart =
      Array.isArray(r.people) && r.people.length > 0
        ? r.people
            .map((p) =>
              [p.full_name || "-", p.employee_id ? `• ${p.employee_id}` : ""].filter(Boolean).join(" ")
            )
            .join(" | ")
        : r.full_name || "(No name)";

    return [
      namePart,
      r.game_name ? `• ${r.game_name}` : "",
      r.slot_start ? `• ${t(r.slot_start)}–${t(r.slot_end)}` : "",
      typeof r.players === "number" ? `• Players: ${r.players}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  };

  // ✅ regenerate QR in same place (no duplicates)
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

      const dataUrl = await QRCode.toDataURL(exit_url, { width: 240, margin: 1 });

      const item: QrItem = {
        session_id,
        label: makeLabel(r),
        dataUrl,
        exit_url,
        generatedAt: new Date().toLocaleString(),
      };

      // replace existing QR for this session
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

  // ---- glow palettes (we'll pick 2-3 based on session id) ----
  const glowPalettes = [
    // cyan -> blue -> violet
    ["rgba(34,211,238,.55)", "rgba(59,130,246,.55)", "rgba(139,92,246,.55)"],
    // pink -> rose -> amber
    ["rgba(236,72,153,.55)", "rgba(244,63,94,.55)", "rgba(245,158,11,.55)"],
    // lime -> emerald -> teal
    ["rgba(163,230,53,.55)", "rgba(16,185,129,.55)", "rgba(20,184,166,.55)"],
    // orange -> red -> fuchsia
    ["rgba(249,115,22,.55)", "rgba(239,68,68,.55)", "rgba(217,70,239,.55)"],
    // indigo -> sky -> cyan
    ["rgba(99,102,241,.55)", "rgba(56,189,248,.55)", "rgba(34,211,238,.55)"],
  ];

  const qrBySession = useMemo(() => {
    const m = new Map<string, QrItem>();
    for (const q of qrs) m.set(q.session_id, q);
    return m;
  }, [qrs]);

  return (
    <main className="min-h-screen bg-black text-white px-4 py-8">
      <style jsx global>{`
        /* Animated glowing accent (driven by CSS variables per card) */
        @keyframes glowShift {
          0% {
            box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08),
              0 0 22px var(--g1),
              0 0 44px rgba(0, 0, 0, 0);
          }
          33% {
            box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.10),
              0 0 22px var(--g2),
              0 0 44px rgba(0, 0, 0, 0);
          }
          66% {
            box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.10),
              0 0 22px var(--g3),
              0 0 44px rgba(0, 0, 0, 0);
          }
          100% {
            box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08),
              0 0 22px var(--g1),
              0 0 44px rgba(0, 0, 0, 0);
          }
        }

        /* Always-on hover feel */
        .noteCard {
          position: relative;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          transform: translateZ(0);
          transition: transform 220ms ease, background 220ms ease;
          animation: glowShift 3.4s ease-in-out infinite;
          overflow: hidden;
        }
        .noteCard::before {
          content: "";
          position: absolute;
          inset: -40%;
          background: radial-gradient(circle at 30% 30%, var(--g1), transparent 45%),
            radial-gradient(circle at 70% 70%, var(--g2), transparent 45%);
          opacity: 0.30;
          filter: blur(26px);
          pointer-events: none;
        }
        .noteCard::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.10),
            rgba(255, 255, 255, 0.02)
          );
          opacity: 0.35;
          pointer-events: none;
        }
        .noteCard:hover {
          transform: translateY(-2px) scale(1.01);
          background: rgba(255, 255, 255, 0.055);
        }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.10);
          font-size: 12px;
          color: rgba(255, 255, 255, 0.78);
          white-space: nowrap;
        }
        .muted {
          color: rgba(255, 255, 255, 0.60);
        }
        .muted2 {
          color: rgba(255, 255, 255, 0.45);
        }
      `}</style>

      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Assistant Panel</h1>
          </div>

          <button
            onClick={logout}
            className="rounded-xl bg-red-600 px-4 py-2 font-semibold hover:bg-red-500"
          >
            Logout
          </button>
        </div>

        {msg && <div className="text-red-300 text-sm">{msg}</div>}

        {/* Cards */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const completed = (r.status || "").toLowerCase() === "ended" || !!r.exit_time;
            const qr = qrBySession.get(r.id);

            const h = hashToInt(r.id);
            const palette = pick(glowPalettes, h);
            const g1 = palette[0];
            const g2 = palette[1];
            const g3 = palette[2];

            return (
              <div
                key={r.id}
                className="noteCard p-5"
                style={
                  {
                    // per-card glow colors
                    ["--g1" as any]: g1,
                    ["--g2" as any]: g2,
                    ["--g3" as any]: g3,
                    // slightly different animation offsets per card
                    animationDelay: `${(h % 13) * -0.27}s`,
                  } as any
                }
              >
                <div className="relative z-10">
                  {/* header row */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs muted2">{dt(r.created_at)}</div>
                      <div className="mt-1 text-lg font-semibold">
                        {r.game_name || "Session"}
                      </div>
                      <div className="mt-1 text-sm muted">
                        {r.slot_start ? `${t(r.slot_start)} – ${t(r.slot_end)}` : "-"}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className="pill">Players: {r.players ?? "-"}</span>
                      {completed ? (
                        <span className="pill" style={{ borderColor: "rgba(34,197,94,0.35)" }}>
                          ✅ Ended
                        </span>
                      ) : (
                        <span className="pill">🟢 Active</span>
                      )}
                    </div>
                  </div>

                  {/* people */}
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <div className="text-xs muted2 mb-2">People</div>

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
                            <div className="text-xs muted">
                              {p.phone || "-"}{" "}
                              <span className="muted2">•</span>{" "}
                              <span className="break-all">{p.email || "-"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm muted">No people data</div>
                    )}
                  </div>

                  {/* actions */}
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => setEndTarget(r)}
                      disabled={completed}
                      className="flex-1 rounded-xl bg-white/10 px-4 py-2.5 font-semibold hover:bg-white/15 disabled:opacity-40"
                    >
                      End Session
                    </button>

                    <button
                      onClick={() => genQr(r)}
                      disabled={completed || !!generating[r.id]}
                      className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold hover:bg-blue-500 disabled:opacity-40"
                    >
                      {generating[r.id] ? "Generating..." : "Generate QR"}
                    </button>
                  </div>

                  {/* QR inline (generated on the card) */}
                  {qr && !completed && (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs font-semibold">{qr.label}</div>
                        <button
                          onClick={() =>
                            setQrs((prev) => prev.filter((x) => x.session_id !== r.id))
                          }
                          className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/15 grid place-items-center"
                          title="Close"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="mt-3 flex justify-center">
                        <img src={qr.dataUrl} alt="Exit QR" className="rounded-xl" />
                      </div>

                      <div className="mt-2 text-xs muted2 break-all">
                        Session: {qr.session_id}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {rows.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
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
                    This will mark session as ended and it will disappear from Assistant view.
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
                    // immediately remove QR for that session
                    setQrs((prev) => prev.filter((q) => q.session_id !== target.id));
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