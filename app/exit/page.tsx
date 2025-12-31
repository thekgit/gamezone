import { Suspense } from "react";
import ExitClient from "./ExitClient";

export default function ExitPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading…</div>}>
      <ExitClient />
    </Suspense>
  );
}