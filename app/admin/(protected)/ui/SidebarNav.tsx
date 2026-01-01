"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function tabClass(active: boolean) {
  return active
    ? "block rounded-lg px-3 py-2 bg-blue-600 font-semibold"
    : "block rounded-lg px-3 py-2 bg-white/10 hover:bg-white/15";
}

export default function SidebarNav() {
  const pathname = usePathname();

  const isVisitors = pathname.startsWith("/admin/dashboard");
  const isGames = pathname.startsWith("/admin/games");

  return (
    <div className="space-y-2">
      <Link href="/admin/dashboard" className={tabClass(isVisitors)}>
        Visitors
      </Link>

      <Link href="/admin/games" className={tabClass(isGames)}>
        Games
      </Link>
    </div>
  );
}