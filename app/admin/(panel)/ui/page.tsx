import UsersClient from "../../../api/admin/users/ui/UsersClient";

export const dynamic = "force-dynamic";

export default function UsersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <UsersClient />
    </div>
  );
}