import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import LogoutButton from "./ui/LogoutButton";

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const c = await cookies();
  const token = c.get("admin_token")?.value;
  if (!token) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-[#f5f6fa] text-[#111] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-black/10 p-4 flex flex-col">
        <div>
          <div className="font-bold text-lg">Admin</div>
          <div className="text-xs text-black/50 mt-1">
            Akshar Game Zone
          </div>

          <div className="mt-6">
            <div className="text-xs font-semibold text-black/40 mb-2">
              Main Menu
            </div>

            <nav className="space-y-1">
              <Link
                href="/admin/visitors"
                className="block w-full rounded-lg px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 font-medium"
              >
                Visitors
              </Link>
              <Link
                href="/admin/visitors"
                className="block w-full rounded-lg px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 font-medium"
              >
                Visitors
              </Link>
              <Link
                href="/admin/users"
                className="block w-full rounded-lg px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 font-medium"
              >
                Users
              </Link>

              <Link
                href="/admin/games"
                className="block w-full rounded-lg px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 font-medium"
              >
                Games
              </Link>
            </nav>
          </div>
        </div>

        {/* Logout at bottom */}
        <div className="mt-auto pt-4">
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}