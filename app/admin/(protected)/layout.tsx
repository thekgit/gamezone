import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import SidebarNav from "../(panel)/SidebarNav";
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const c = await cookies();
  const token = c.get("admin_token")?.value;

  if (!token) redirect("/admin/login");

  return (
    <div className="flex min-h-screen bg-[#0b0b0b] text-white">
      <aside className="w-64 bg-black border-r border-white/10 p-5">
        <h2 className="text-lg font-bold">Admin</h2>
        <p className="text-xs text-white/50 mb-6">Akshar Game Zone</p>

        {/* ✅ Blue active highlight handled inside SidebarNav */}
        <SidebarNav />

        <form action="/api/admin/logout" method="post">
          <button className="mt-6 w-full rounded-lg bg-white/10 px-3 py-2 text-left hover:bg-white/15">
            Logout
          </button>
        </form>
      </aside>

      <main className="flex-1 p-6 bg-[#111] overflow-y-auto">{children}</main>
    </div>
  );
}