import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import LogoutButton from "./ui/LogoutButton";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const c = await cookies();
  const token = c.get("admin_token")?.value;
  if (!token) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-[#f5f6fa] text-[#111] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-black/10 p-4">
        <div className="font-bold text-lg">Admin</div>
        <div className="text-xs text-black/50 mt-1">Akshar Game Zone</div>

        <div className="mt-6">
          <div className="text-xs font-semibold text-black/40 mb-2">Main Menu</div>

          <Link
            href="/admin/visitors"
            className="block w-full rounded-lg px-3 py-2 bg-blue-50 text-blue-700 font-medium"
          >
            Visitors
          </Link>

          <div className="mt-4">
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}