"use client";

import { useEffect, useMemo, useState } from "react";
import SearchBar from "./SearchBar";
import EditUserModal from "./EditUserModal";
import ConfirmModal from "./ConfirmModal";

export type AdminUser = {
  user_id: string;          // profiles.user_id (PK)
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

  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [confirm, setConfirm] = useState<{ type: "delete" | "reset"; user: AdminUser } | null>(
    null
  );

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users/list", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      // ✅ Expect { users: [...] }
      setUsers(Array.isArray(data?.users) ? data.users : []);
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
    <>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-lg font-semibold text-white">Users</div>
          <div className="text-sm text-white/60">
            View / edit / reset password / delete users (sessions remain untouched).
          </div>
        </div>

        <button
          type="button"
          onClick={loadUsers}
          className="rounded-xl bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/15"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <SearchBar value={query} onChange={setQuery} />

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-sm text-white">
          <thead className="bg-white/10 text-white/80">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Employee ID</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Phone</th>
              <th className="text-left px-4 py-3">Company</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((u) => (
              <tr key={u.user_id} className="border-t border-white/10">
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
                <td className="px-4 py-6 text-white/60" colSpan={6}>
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
    </>
  );
}