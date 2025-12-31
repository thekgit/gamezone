import { Suspense } from "react";
import ExitClient from "./ExitClient";

export default function ExitPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black text-white">Loading...</div>}>
      <ExitClient />
    </Suspense>
  );
}