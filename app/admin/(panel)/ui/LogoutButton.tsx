"use client";

export default function LogoutButton() {
  const onLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };

  return (
    <button
      onClick={onLogout}
      className="w-full rounded-lg px-3 py-2 border border-black/10 bg-white hover:bg-black/5 text-left"
    >
      Logout
    </button>
  );
}