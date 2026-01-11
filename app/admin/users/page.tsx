import UsersClient from "./ui/UsersClient";

export default function UsersPage() {
  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      <UsersClient />
    </div>
  );
}