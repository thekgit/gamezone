import { Suspense } from "react";
import SetPasswordClient from "./ui/SetPasswordClient";

export const dynamic = "force-dynamic";

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordClient />
    </Suspense>
  );
}