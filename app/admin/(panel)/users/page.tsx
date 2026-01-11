// app/admin/(panel)/users/page.tsx
import UsersClient from "../ui/UsersClient";

export default function UsersPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      <UsersClient />
    </div>
  );
}