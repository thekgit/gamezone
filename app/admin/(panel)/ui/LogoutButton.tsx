"use client";

export default function LogoutButton() {
  const onLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };

  return (
    <button
      onClick={onLogout}
      className="w-full rounded-lg px-3 py-2 bg-white/10 text-white font-medium hover:bg-white/15"
    >
      Logout
    </button>
  );
}