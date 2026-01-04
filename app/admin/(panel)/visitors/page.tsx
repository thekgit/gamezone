import AparUsersClient from "../ui/AparUsersClient";
import VisitorsTableClient from "../ui/VisitorsTableClient";

export default function AdminVisitorsPage() {
  return (
    <div className="text-white">
      {/* ✅ NEW: Import + Manual create panel */}
      <AparUsersClient />

      {/* Existing table */}
      <VisitorsTableClient />
    </div>
  );
}