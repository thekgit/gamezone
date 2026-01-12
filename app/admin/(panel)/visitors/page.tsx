import VisitorsTableClient from "../ui/VisitorsTableClient";

export default function AdminVisitorsPage() {
  return (
    <div className="w-full space-y-4">
      {/* Header like your old “good” visitors page */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold text-white">Active / Past Sessions</div>
          <div className="text-sm text-white/60">
            Active sessions timeline + Generate Exit QR.
          </div>
        </div>
      </div>

      {/* ✅ ONLY the table (no APAR import UI) */}
      <VisitorsTableClient />
    </div>
  );
}