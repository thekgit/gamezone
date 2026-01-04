import AparUsersClient from "../ui/AparUsersClient";
import VisitorsTableClient from "../ui/VisitorsTableClient";

export default function AdminVisitorsPage() {
  return (
    <div className="space-y-6">
      {/* ✅ NEW: Import + Manual Create UI (APAR) */}
      <AparUsersClient />

      {/* ✅ Existing: Visitors sessions + QR table */}
      <VisitorsTableClient />
    </div>
  );
}