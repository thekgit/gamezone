"use client";

import { useEffect, useMemo, useState } from "react";
import SearchBar from "./SearchBar";
import EditUserModal from "./EditUserModal";
import ConfirmModal from "./ConfirmModal";

export type AdminUser = {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  employee_id?: string | null;
  company?: string | null;
};

export default function UsersClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [confirm, setConfirm] = useState<{ type: "delete" | "reset"; user: AdminUser } | null>(
    null
  );

  const loadUsers = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setUsers([]);
        setErrorMsg(data?.error || `Failed to load users (${res.status})`);
        return;
      }

      const list = Array.isArray(data) ? data : Array.isArray(data?.users) ? data.users : [];
      setUsers(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      `${u.full_name} ${u.email} ${u.phone} ${u.employee_id || ""} ${u.company || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [users, query]);

  return (
    <div className="w-full text-white">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Users</div>
          <div className="text-sm text-white/60">
            View / edit / reset password / delete users (sessions remain untouched).
          </div>
        </div>

        <button
          type="button"
          onClick={loadUsers}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {errorMsg ? (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {errorMsg}
        </div>
      ) : null}

      {/* Search full width */}
      <div className="mt-4 w-full">
        <SearchBar value={query} onChange={setQuery} />
      </div>

      {/* Full width container */}
      <div className="mt-4 w-full rounded-2xl border border-white/10 bg-black/30">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="border-b border-white/10 text-white/70">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Name</th>
                <th className="text-left px-4 py-3 font-semibold">Employee ID</th>
                <th className="text-left px-4 py-3 font-semibold">Email</th>
                <th className="text-left px-4 py-3 font-semibold">Phone</th>
                <th className="text-left px-4 py-3 font-semibold">Company</th>
                <th className="text-left px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {filtered.map((u) => (
                <tr key={u.user_id} className="hover:bg-white/5">
                  <td className="px-4 py-3">{u.full_name}</td>
                  <td className="px-4 py-3">{u.employee_id || "-"}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{u.phone}</td>
                  <td className="px-4 py-3">{u.company || "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditUser(u)}
                        className="rounded-lg bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/15"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirm({ type: "reset", user: u })}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold hover:bg-blue-500"
                      >
                        Reset Password
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirm({ type: "delete", user: u })}
                        className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold hover:bg-red-500"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-white/60" colSpan={6}>
                    {loading ? "Loading..." : "No users found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => {
            setEditUser(null);
            loadUsers();
          }}
        />
      )}

      {confirm && (
        <ConfirmModal
          open={true}
          type={confirm.type}
          user={confirm.user}
          onClose={() => setConfirm(null)}
          onDone={() => {
            setConfirm(null);
            loadUsers();
          }}
        />
      )}
    </div>
  );
}