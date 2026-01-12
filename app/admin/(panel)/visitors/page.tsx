import AparUsersClient from "../ui/AparUsersClient";
import VisitorsTableClient from "../ui/VisitorsTableClient";

export default function AdminVisitorsPage() {
  return (
    <div className="space-y-10">
      {/* Visitors Sessions FIRST */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Active / Past Sessions</h2>
        <VisitorsTableClient />
      </section>

      {/* User Import SECOND (collapsed visually) */}
      <section className="opacity-90">
        <h2 className="text-lg font-semibold text-white mb-3">APAR Users</h2>
        <AparUsersClient />
      </section>
    </div>
  );
}