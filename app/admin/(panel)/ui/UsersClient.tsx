"use client";

import { useEffect, useState } from "react";

type UserRow = {
  id: string;
  full_name: string;
  employee_id?: string | null;
  email: string;
  phone?: string | null;
  company?: string | null;
};

export default function UsersClient() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<{ id: string; action: "delete" | "reset" } | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const out = await res.json();
    setRows(out.rows || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = rows.filter((u) => {
    const q = query.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone || "").includes(q)
    );
  });

  async function handleDelete(id: string) {
    if (!confirm) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setConfirm(null);
    load();
  }

  async function handleReset(id: string) {
    if (!confirm) return;
    await fetch("/api/admin/users/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setConfirm(null);
  }

  return (
    <div className="w-full">
      <div className="flex justify-between mb-4">
        <input
          placeholder="Search by name, email, or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="rounded-xl px-4 py-2 border border-gray-300 w-72"
        />
        <button
          onClick={load}
          className="rounded-xl bg-blue-600 text-white px-4 py-2 font-semibold"
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Employee ID</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">Company</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-3 py-2">{u.full_name}</td>
                <td className="px-3 py-2">{u.employee_id || "-"}</td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{u.phone || "-"}</td>
                <td className="px-3 py-2">{u.company || "-"}</td>
                <td className="px-3 py-2 space-x-2">
                  <button
                    onClick={() => alert("Edit not yet wired")}
                    className="px-3 py-1 rounded bg-blue-500 text-white"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirm({ id: u.id, action: "reset" })}
                    className="px-3 py-1 rounded bg-yellow-500 text-white"
                  >
                    Reset Password
                  </button>
                  <button
                    onClick={() => setConfirm({ id: u.id, action: "delete" })}
                    className="px-3 py-1 rounded bg-red-600 text-white"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-80 relative">
            <button
              onClick={() => setConfirm(null)}
              className="absolute top-2 right-3 text-xl text-gray-500"
            >
              ×
            </button>
            <h2 className="text-lg font-bold mb-4">
              {confirm.action === "delete"
                ? "Delete user?"
                : "Reset password for this user?"}
            </h2>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setConfirm(null)}
                className="px-4 py-2 rounded bg-gray-200"
              >
                No
              </button>
              <button
                onClick={() =>
                  confirm.action === "delete"
                    ? handleDelete(confirm.id)
                    : handleReset(confirm.id)
                }
                className="px-4 py-2 rounded bg-red-600 text-white"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}