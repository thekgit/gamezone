import UsersClient from "./ui/UsersClient";

export default function UsersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <UsersClient />
    </div>
  );
}