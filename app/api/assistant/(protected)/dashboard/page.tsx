"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useRouter } from "next/navigation";

type Person = {
  user_id: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  employee_id: string | null;
};

type Row = {
  id: string;
  people?: Person[];
  created_at: string;
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

// ✅ same “people rendering” style as admin
function PeopleBlock({ people }: { people?: Person[] }) {
  const list = Array.isArray(people) ? people : [];
  if (list.length === 0) return <div className="text-white/60">-</div>;

  return (
    <div className="space-y-2">
      {list.map((p, idx) => (
        <div key={(p.user_id || "x") + ":" + idx} className="leading-5">
          <div className="font-semibold">
            {(p.full_name || "Guest")}
            {p.employee_id ? ` • ${p.employee_id}` : ""}
          </div>
          <div className="text-xs text-white/60">
            {(p.phone || "-")}
          </div>
          <div className="text-xs text-white/60">
            {(p.email || "-")}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AssistantDashboard() {
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
      if (!res.ok) {
        if (res.status === 401) router.replace("/assistant/login");
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
      const completed = (r.status || "").toLowerCase() === "ended" || !!r.exit_time;
      m.set(r.id, completed);
    }
    return m;
  }, [rows]);

  useEffect(() => {
    setQrs((prev) => prev.filter((q) => !completedMap.get(q.session_id)));
  }, [completedMap]);

  // ✅ Make assistant QR match admin behavior (random each click)
  // This assumes /api/assistant/exit-code returns a fresh token/exit_url like admin.
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

      // ✅ label similar to admin (people + game + slot)
      const p0 = r.people?.[0];
      const label = [
        (p0?.full_name || "Guest") + (p0?.employee_id ? ` • ${p0.employee_id}` : ""),
        ...(r.people?.slice(1).map((p) => (p.full_name || "Guest") + (p.employee_id ? ` • ${p.employee_id}` : "")) || []),
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
      setMsg(e?.message || "QR generation failed");
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
    try {
      await fetch("/api/assistant/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      router.replace("/assistant/login");
    }
  };

  return (
    <main className="min-h-screen bg-black text-white px-4 py-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Assistant Panel</h1>
            <p className="text-white/60 text-sm">Active sessions only • Actions: End + Generate QR</p>
          </div>

          <button
            onClick={logout}
            className="rounded-xl bg-red-600 px-4 py-2 font-semibold hover:bg-red-500"
          >
            Logout
          </button>
        </div>

        {msg && <div className="text-red-300 text-sm">{msg}</div>}

        {qrs.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
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

        <div className="overflow-auto rounded-2xl border border-white/10 bg-[#0b0b0b]">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/70">
              <tr>
                <th className="p-3 text-left">Timestamp</th>
                <th className="p-3 text-left">People</th>
                <th className="p-3 text-left">Game</th>
                <th className="p-3 text-left">Players</th>
                <th className="p-3 text-left">Slot</th>
                <th className="p-3 text-left">End Session</th>
                <th className="p-3 text-left">QR</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const completed = (r.status || "").toLowerCase() === "ended" || !!r.exit_time;

                return (
                  <tr key={r.id} className="border-t border-white/10 hover:bg-white/5 align-top">
                    <td className="p-3">{dt(r.created_at)}</td>

                    {/* ✅ Now shows keyur • kp12 + DHRUV • DK12345 etc */}
                    <td className="p-3">
                      <PeopleBlock people={r.people} />
                    </td>

                    <td className="p-3">{r.game_name || "-"}</td>
                    <td className="p-3">{r.players ?? "-"}</td>
                    <td className="p-3">
                      {r.slot_start ? `${t(r.slot_start)} – ${t(r.slot_end)}` : "-"}
                    </td>

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
                        <span className="text-green-400 font-semibold">Ended</span>
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
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td className="p-4 text-white/60" colSpan={7}>
                    No active sessions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {endTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-lg font-semibold">End this session?</div>
                  <div className="text-sm text-white/60 mt-1">
                    If slot time passed, end time will be slot end. Otherwise it will be now.
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
      </div>
    </main>
  );
}