"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function EntryPage() {
  const router = useRouter();
  const [seconds, setSeconds] = useState(5);

  useEffect(() => {
    // countdown UI (optional, but nice)
    const t = setInterval(() => {
      setSeconds((s) => (s > 1 ? s - 1 : 1));
    }, 1000);

    // redirect after 5 seconds
    const r = setTimeout(() => {
      router.replace("/home");
    }, 5000);

    return () => {
      clearInterval(t);
      clearTimeout(r);
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-black text-white px-4 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <div className="text-2xl font-bold">✅ Slot has been created successfully</div>
        <div className="mt-3 text-white/70 text-sm">
          Please wait. Manager will handle entry/exit from Admin panel.
        </div>

        <div className="mt-4 text-white/60 text-sm">
          Redirecting to Home in <span className="text-white font-semibold">{seconds}</span> seconds…
        </div>

        <button
          type="button"
          onClick={() => router.replace("/home")}
          className="mt-5 w-full rounded-xl bg-white text-black py-3 font-semibold hover:bg-white/90"
        >
          Go to Home Now
        </button>
      </div>
    </main>
  );
}