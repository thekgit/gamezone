"use client";

import { useEffect, useMemo, useState } from "react";

export default function VisitorsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    setMsg("");
    const res = await fetch("/api/admin/visitors", {
      headers: { "x-admin-secret": process.env.NEXT_PUBLIC_ADMIN_SECRET! },
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(out?.error || "Failed");
    setRows(out.visitors || []);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.full_name, r.phone, r.email].some((v) => (v || "").toLowerCase().includes(s))
    );
  }, [rows, q]);

  const downloadCSV = () => {
    const header = ["User ID", "Name", "Phone", "Email", "Created At"];
    const lines = [header.join(",")].concat(
      filtered.map((r) =>
        [r.user_id, r.full_name, r.phone, r.email, r.created_at].map((x) => `"${x ?? ""}"`).join(",")
      )
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "visitors.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">All Visitors</h1>
          <p className="text-white/60 mt-1 text-sm">Name / phone / email list</p>
        </div>

        <button onClick={downloadCSV} className="rounded-xl bg-white text-black px-4 py-2 font-semibold">
          Download CSV
        </button>
      </div>

      <div className="mt-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search visitors..."
          className="w-full max-w-sm rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none"
        />
      </div>

      {msg && <div className="mt-3 text-red-300 text-sm">{msg}</div>}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Phone</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">User ID</th>
              <th className="text-left p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.user_id} className="border-t border-white/10">
                <td className="p-3">{r.full_name || "-"}</td>
                <td className="p-3">{r.phone || "-"}</td>
                <td className="p-3">{r.email || "-"}</td>
                <td className="p-3 text-white/60">{r.user_id}</td>
                <td className="p-3 text-white/60">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="p-3 text-white/60" colSpan={5}>
                  No visitors
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}