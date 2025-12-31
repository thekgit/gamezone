"use client";

type Row = {
  id: string;
  timestamp: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  game: string | null;
  slot: string | null;
  exit_time?: string | null; // ✅ new
  status?: string | null;    // optional if you already send it
};

function fmtTime(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function VisitorsTable({ rows }: { rows: Row[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      <table className="w-full text-sm text-white">
        <thead className="text-white/60">
          <tr className="border-b border-white/10">
            <th className="text-left px-4 py-3">Timestamp</th>
            <th className="text-left px-4 py-3">Name</th>
            <th className="text-left px-4 py-3">Phone</th>
            <th className="text-left px-4 py-3">Email</th>
            <th className="text-left px-4 py-3">Game</th>
            <th className="text-left px-4 py-3">Slot</th>

            {/* ✅ NEW COLUMN */}
            <th className="text-left px-4 py-3">Exit Time</th>

            <th className="text-left px-4 py-3">QR</th>
          </tr>
        </thead>

        <tbody>
          {rows?.map((r) => (
            <tr key={r.id} className="border-b border-white/10 last:border-0">
              <td className="px-4 py-4">{r.timestamp || "-"}</td>
              <td className="px-4 py-4">{r.name || "-"}</td>
              <td className="px-4 py-4">{r.phone || "-"}</td>
              <td className="px-4 py-4">{r.email || "-"}</td>
              <td className="px-4 py-4">{r.game || "-"}</td>
              <td className="px-4 py-4">{r.slot || "-"}</td>

              {/* ✅ NEW DATA */}
              <td className="px-4 py-4">{fmtTime(r.exit_time)}</td>

              <td className="px-4 py-4">
                {/* Your existing button rendering stays here (don’t change yet) */}
                {/* If you already render Generate QR button here, keep it same for now */}
                {(r as any).qrButton}
              </td>
            </tr>
          ))}

          {!rows?.length && (
            <tr>
              <td className="px-4 py-8 text-white/50" colSpan={8}>
                No sessions yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}