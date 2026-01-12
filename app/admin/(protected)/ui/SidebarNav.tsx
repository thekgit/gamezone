"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function linkClass(active: boolean) {
  return active
    ? "block rounded-lg px-3 py-2 bg-blue-600 font-semibold"
    : "block rounded-lg px-3 py-2 bg-white/10 hover:bg-white/15";
}

export default function SidebarNav() {
  const pathname = usePathname();

  // ✅ IMPORTANT: Visitors must be /admin/visitors (NOT /admin/dashboard)
  const isVisitors = pathname.startsWith("/admin/visitors");
  const isUsers = pathname.startsWith("/admin/users");
  const isGames = pathname.startsWith("/admin/games");

  return (
    <div className="space-y-2">
      <Link href="/admin/visitors" className={linkClass(isVisitors)}>
        Visitors
      </Link>

      <Link href="/admin/users" className={linkClass(isUsers)}>
        Users
      </Link>

      <Link href="/admin/games" className={linkClass(isGames)}>
        Games
      </Link>
    </div>
  );
}