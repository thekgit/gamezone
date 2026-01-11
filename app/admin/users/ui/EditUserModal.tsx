"use client";

import { useState } from "react";
import type { AdminUser } from "./UsersClient";
import ConfirmModalShell from "./ConfirmModalShell";

export default function EditUserModal({
  user,
  onClose,
}: {
  user: AdminUser;
  onClose: () => void;
}) {
  const [full_name, setFullName] = useState(user.full_name || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [employee_id, setEmployeeId] = useState(user.employee_id || "");
  const [company, setCompany] = useState(user.company || "");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async () => {
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.user_id,
          full_name: full_name.trim(),
          phone: phone.trim(),
          employee_id: employee_id.trim(),
          company: company.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Update failed");
        return;
      }

      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfirmModalShell
      open={true}
      title="Edit User"
      description="Email cannot be changed."
      onClose={onClose}
    >
      {msg ? <div className="mb-3 text-sm text-red-400">{msg}</div> : null}

      <div className="grid gap-2">
        <input
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2"
          value={full_name}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Full name"
        />

        <input
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone"
        />

        <input
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2"
          value={employee_id}
          onChange={(e) => setEmployeeId(e.target.value)}
          placeholder="Employee ID"
        />

        <input
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company"
        />

        <input
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 opacity-70"
          value={user.email}
          disabled
        />

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-white/10 py-2.5 font-semibold hover:bg-white/15"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={save}
            disabled={loading}
            className="flex-1 rounded-xl bg-white text-black py-2.5 font-semibold hover:bg-white/90 disabled:opacity-40"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </ConfirmModalShell>
  );
}