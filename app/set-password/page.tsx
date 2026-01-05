import { Suspense } from "react";
import SetPasswordClient from "./ui/SetPasswordClient";

export default function SetPasswordPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const next =
    typeof searchParams?.next === "string" && searchParams.next.length > 0
      ? searchParams.next
      : "/home";

  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>}>
      <SetPasswordClient next={next} />
    </Suspense>
  );
}