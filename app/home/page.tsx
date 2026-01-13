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
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HomePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Logout
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      router.replace("/");
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
  }, []);

  return (
    <main className="min-h-screen bg-black text-white px-4 py-10">
      <div className="mx-auto w-full max-w-3xl text-center">
        {/* ✅ Page title */}
        <h1 className="text-3xl font-bold">Welcome to the Game Zone</h1>
        <p className="text-white/60 mt-2">
          Your active sessions are shown below.
        </p>

        {msg && <div className="mt-4 text-sm text-red-400">{msg}</div>}

        {/* ✅ Active sessions box */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Active Sessions</h2>

          {sessions.length === 0 ? (
            <div className="mt-4 text-white/60 text-sm">
              No active sessions right now.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-white/10 bg-black/30 p-4 text-center"
                >
                  <div className="font-semibold text-lg">
                    {s.game_name || "Game"}
                  </div>

                  <div className="mt-2 inline-block text-xs px-3 py-1 rounded-full bg-green-600/20 text-green-300 border border-green-500/30">
                    Active
                  </div>

                  <div className="mt-3 text-sm text-white/70">
                    Players:{" "}
                    <span className="text-white">{s.players ?? "-"}</span>
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

        {/* ✅ Actions */}
        <div className="mt-6 space-y-4">
          <Link
            href="/select"
            className="block w-full rounded-2xl py-4 font-semibold bg-blue-600 hover:bg-blue-500"
          >
            Slot Booking
          </Link>

          <button
            onClick={logout}
            className="w-full rounded-2xl py-3 font-semibold bg-red-600 hover:bg-red-500"
          >
            Logout
          </button>
        </div>
      </div>
    </main>
  );
}