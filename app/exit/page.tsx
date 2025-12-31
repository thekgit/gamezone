import { Suspense } from "react";
import ExitClient from "./ExitClient";

export default function ExitPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
            <h1 className="text-2xl font-bold">Exit</h1>
            <p className="mt-3 text-white/70">Loading...</p>
          </div>
        </main>
      }
    >
      <ExitClient />
    </Suspense>
  );
}