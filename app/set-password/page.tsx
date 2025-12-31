import { Suspense } from "react";
import SetPasswordClient from "./ui/SetPasswordClient";

export const dynamic = "force-dynamic";

export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          Loading…
        </div>
      }
    >
      <SetPasswordClient />
    </Suspense>
  );
}