"use client";

import type { AdminUser } from "./UsersClient";
import ConfirmModalShell from "./ConfirmModalShell";
import { useState } from "react";

export default function ConfirmModal({
  open,
  type,
  user,
  onClose,
  onDone,
}: {
  open: boolean;
  type: "delete" | "reset";
  user: AdminUser;
  onClose: () => void;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const title = type === "delete" ? "Delete user" : "Reset password";
  const description =
    type === "delete"
      ? "Are you sure you want to delete this user? Their past sessions will remain."
      : "Are you sure you want to reset this user's password to NEW12345? They will be forced to set a new password on next login.";

  const yes = async () => {
    setMsg("");
    setLoading(true);
    try {
      const url = type === "delete" ? "/api/admin/users/delete" : "/api/admin/users/reset";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.user_id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Action failed");
        return;
      }
      onDone();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfirmModalShell open={open} title={title} description={description} onClose={onClose}>
      {msg ? <div className="mb-3 text-sm text-red-400">{msg}</div> : null}

      <div className="text-sm text-white/70">
        <div className="font-semibold text-white">{user.full_name}</div>
        <div>{user.email}</div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl bg-white/10 py-2.5 font-semibold hover:bg-white/15"
          disabled={loading}
        >
          No
        </button>

        <button
          type="button"
          onClick={yes}
          className={`flex-1 rounded-xl py-2.5 font-semibold ${
            type === "delete" ? "bg-red-600 hover:bg-red-500" : "bg-blue-600 hover:bg-blue-500"
          } disabled:opacity-40`}
          disabled={loading}
        >
          {loading ? "Working..." : "Yes"}
        </button>
      </div>
    </ConfirmModalShell>
  );
}