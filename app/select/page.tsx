"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ActiveSession = {
  id: string;
  game_name: string | null;
  players: number | null;
  started_at: string | null;
  ends_at: string | null;
  status: string | null;
};

function t(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function SelectClient({ userId }: { userId: string }) {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setMsg("");
    const res = await fetch(`/api/sessions/active?user_id=${encodeURIComponent(userId)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data?.error || "Failed to load sessions");
      return;
    }
    setSessions(data.sessions || []);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="min-h-screen bg-black text-white px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-3xl font-bold">Welcome to the Game Zone</h1>
        <p className="text-white/60 mt-2">Your active sessions are shown below.</p>

        {msg && <div className="mt-4 text-sm text-red-400">{msg}</div>}

        {/* ✅ Active sessions box */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Active Sessions</h2>
            <button
              onClick={load}
              className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15"
            >
              Refresh
            </button>
          </div>

          {sessions.length === 0 ? (
            <div className="mt-4 text-white/60 text-sm">
              No active sessions right now.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{s.game_name || "Game"}</div>
                    <div className="text-xs px-3 py-1 rounded-full bg-green-600/20 text-green-300 border border-green-500/30">
                      Active
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-white/70">
                    Players: <span className="text-white">{s.players ?? "-"}</span>
                  </div>

                  <div className="mt-1 text-sm text-white/70">
                    Time:{" "}
                    <span className="text-white">
                      {t(s.started_at)} – {t(s.ends_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ✅ Slot booking button */}
        <div className="mt-6">
          <Link
            href="/select" // change to your actual booking page route if different
            className="block w-full rounded-2xl py-4 text-center font-semibold bg-blue-600 hover:bg-blue-500"
          >
            Slot Booking
          </Link>

          {/* If your booking page is something else, replace /select with it.
              Example: /slots or /booking */}
        </div>
      </div>
    </main>
  );
}