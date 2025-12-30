"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  id: string;              // session id
  created_at: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  game_name: string | null;
  slot_label: string | null;
};

function fmt(dt: string) {
  const d = new Date(dt);
  return d.toLocaleString();
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function VisitorsTableClient() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.full_name, r.email, r.phone, r.user_id, r.game_name, r.slot_label]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(s))
    );
  }, [q, rows]);

  const load = async () => {
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/visitors", { method: "GET" });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg(out?.error || "Failed to load visitors");
      setRows(out.rows || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // hook buttons on page.tsx (simple)
  useEffect(() => {
    const csvBtn = document.getElementById("downloadCsvBtn");
    const xlsBtn = document.getElementById("downloadExcelBtn");
    if (!csvBtn || !xlsBtn) return;

    const onCsv = () => {
      const header = ["Booking Timestamp", "Order ID", "User ID", "Phone", "Email", "Name", "Game", "Slot"];
      const lines = filtered.map((r) => [
        fmt(r.created_at),
        r.id,
        r.user_id,
        r.phone ?? "",
        r.email ?? "",
        r.full_name ?? "",
        r.game_name ?? "",
        r.slot_label ?? "",
      ]);
      const csv =
        [header, ...lines]
          .map((arr) => arr.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
          .join("\n") + "\n";

      downloadFile(`visitors_${Date.now()}.csv`, csv, "text/csv;charset=utf-8");
    };

    const onExcel = () => {
      // simple: export CSV but with .xlsx name (works for most)
      const header = ["Booking Timestamp", "Order ID", "User ID", "Phone", "Email", "Name", "Game", "Slot"];
      const lines = filtered.map((r) => [
        fmt(r.created_at),
        r.id,
        r.user_id,
        r.phone ?? "",
        r.email ?? "",
        r.full_name ?? "",
        r.game_name ?? "",
        r.slot_label ?? "",
      ]);
      const tsv =
        [header, ...lines]
          .map((arr) => arr.map((v) => String(v).replaceAll("\t", " ")).join("\t"))
          .join("\n") + "\n";

      downloadFile(`visitors_${Date.now()}.xls`, tsv, "application/vnd.ms-excel");
    };

    csvBtn.addEventListener("click", onCsv);
    xlsBtn.addEventListener("click", onExcel);
    return () => {
      csvBtn.removeEventListener("click", onCsv);
      xlsBtn.removeEventListener("click", onExcel);
    };
  }, [filtered]);

  const onGenerateQR = async (session_id: string) => {
    setMsg("");
    const res = await fetch("/api/admin/exit-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(out?.error || "Failed to generate QR");

    // show the QR by opening the exit page (your existing /exit reads ?code=)
    window.open(`/exit?code=${encodeURIComponent(out.code)}`, "_blank");
  };

  return (
    <div className="bg-white border border-black/10 rounded-xl">
      <div className="p-4 flex items-center justify-between gap-3">
        <input
          className="w-full max-w-sm rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
          placeholder="Search visitors..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          onClick={load}
          className="rounded-lg px-3 py-2 border border-black/10 bg-white hover:bg-black/5 text-sm"
        >
          Refresh
        </button>
      </div>

      {msg && <div className="px-4 pb-3 text-sm text-red-600">{msg}</div>}

      <div className="overflow-auto">
        <table className="min-w-[1100px] w-full text-sm">
         <thead className="bg-gray-100">
                <tr className="text-gray-700 text-sm">
                <th className="px-4 py-3 text-left">Booking Time</th>
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">User ID</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">QR</th>
                </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-black/50" colSpan={9}>
                  Loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-black/50" colSpan={9}>
                  No records.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t border-black/10">
                  <td className="px-4 py-3 whitespace-nowrap">{fmt(r.created_at)}</td>
                  <td className="px-4 py-3">{r.id}</td>
                  <td className="px-4 py-3">{r.user_id}</td>
                  <td className="px-4 py-3">{r.phone ?? "-"}</td>
                  <td className="px-4 py-3">{r.email ?? "-"}</td>
                  <td className="px-4 py-3">{r.full_name ?? "-"}</td>
                  <td className="px-4 py-3">{r.game_name ?? "-"}</td>
                  <td className="px-4 py-3">{r.slot_label ?? "-"}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onGenerateQR(r.id)}
                      className="rounded-lg px-3 py-2 bg-blue-600 text-white text-xs font-semibold"
                    >
                      Generate QR
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="p-3 text-xs text-black/50">
        Showing {filtered.length} records
      </div>
    </div>
  );
}