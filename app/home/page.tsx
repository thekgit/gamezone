"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

export default function HomePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ NEW: Logout handler
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      router.replace("/"); // -> https://k-e18b.vercel.app/
    }
  };

  const load = async () => {
    setMsg("");
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const jwt = sess?.session?.access_token;

      if (!jwt) {
        router.replace("/login?next=/home");
        return;
      }

      // ✅ EXTRA SAFETY CHECK (fixes mobile issue)
      const { data: userRes, error: uErr } = await supabase.auth.getUser();

      if (uErr || !userRes?.user) {
        await supabase.auth.signOut();
        router.replace("/login?next=/home");
        return;
      }

      const res = await fetch("/api/sessions/active", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${jwt}` },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Failed to load sessions");
        return;
      }

      setSessions(data.sessions || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-black text-white px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        {/* ✅ Title row + Logout */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Welcome to the Game Zone</h1>
            <p className="text-white/60 mt-2">Your active sessions are shown below.</p>
          </div>

          
        </div>

        {msg && <div className="mt-4 text-sm text-red-400">{msg}</div>}

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Active Sessions</h2>
            <button
              onClick={load}
              disabled={loading}
              className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {sessions.length === 0 ? (
            <div className="mt-4 text-white/60 text-sm">No active sessions right now.</div>
          ) : (
            <div className="mt-4 space-y-3">
              {sessions.map((s) => (
                <div key={s.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
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
                    Time: <span className="text-white">{t(s.started_at)} – {t(s.ends_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6">
          <Link
            href="/select"
            className="block w-full rounded-2xl py-4 text-center font-semibold bg-blue-600 hover:bg-blue-500"
          >
            Slot Booking
          </Link>
          <div className="mt-4">
            <button
              onClick={logout}
              className="w-full rounded-2xl py-3 text-center font-semibold bg-red-600 hover:bg-red-500"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}