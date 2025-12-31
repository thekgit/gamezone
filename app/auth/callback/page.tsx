"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // important
    },
  }
);

function getNextFromSearch() {
  const sp = new URLSearchParams(window.location.search);
  return sp.get("next") || "/set-password?next=/select";
}

function parseHashTokens() {
  // hash looks like: #access_token=...&refresh_token=...&type=invite
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;

  const hp = new URLSearchParams(hash);
  const access_token = hp.get("access_token");
  const refresh_token = hp.get("refresh_token");

  return { access_token, refresh_token };
}

export default function AuthCallbackPage() {
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    const run = async () => {
      const next = getNextFromSearch();

      // 1) If Supabase auto-detected session from URL, great:
      const { data: s1 } = await supabase.auth.getSession();
      if (s1.session) {
        window.location.replace(next);
        return;
      }

      // 2) Otherwise, manually set session from hash tokens:
      const { access_token, refresh_token } = parseHashTokens();

      if (!access_token || !refresh_token) {
        setMsg("Invite link did not contain session tokens. Redirecting to login…");
        window.location.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) {
        setMsg("Invite session invalid/expired. Redirecting to login…");
        window.location.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      window.location.replace(next);
    };

    run();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      {msg}
    </div>
  );
}