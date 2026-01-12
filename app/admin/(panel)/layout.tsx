import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import SidebarNav from "./ui/SidebarNav";
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
    <div className="flex min-h-screen bg-[#0b0b0b] text-white">
      <aside className="w-64 bg-black border-r border-white/10 p-5 flex flex-col">
        <div>
          <h2 className="text-lg font-bold text-white">Admin</h2>
          <p className="text-xs text-white/50 mb-6">Akshar Game Zone</p>

          {/* ✅ Blue active highlight */}
          <SidebarNav />
        </div>

        {/* ✅ Logout visible directly below menu */}
        <div className="mt-4">
          <LogoutButton />
        </div>
      </aside>

      {/* ✅ Full width content */}
      <main className="flex-1 p-6 bg-[#111] overflow-y-auto">
        <div className="w-full">{children}</div>
      </main>
    </div>
  );
}