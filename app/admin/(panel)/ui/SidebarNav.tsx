"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function cls(active: boolean) {
  return active
    ? "block rounded-lg px-3 py-2 bg-blue-600 text-white font-semibold"
    : "block rounded-lg px-3 py-2 bg-white/10 hover:bg-white/15 text-white";
}

export default function SidebarNav() {
  const pathname = usePathname();

  const isVisitors = pathname.startsWith("/admin/visitors");
  const isUsers = pathname.startsWith("/admin/users");
  const isGames = pathname.startsWith("/admin/games");

  return (
    <div className="space-y-2">
      <Link href="/admin/visitors" className={cls(isVisitors)}>Visitors</Link>
      <Link href="/admin/users" className={cls(isUsers)}>Users</Link>
      <Link href="/admin/games" className={cls(isGames)}>Games</Link>
    </div>
  );
}