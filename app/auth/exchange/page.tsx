import { Suspense } from "react";
import ExchangeClient from "./ui/ExchangeClient";

export const dynamic = "force-dynamic";

export default function ExchangePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Signing you in…</div>}>
      <ExchangeClient />
    </Suspense>
  );
}