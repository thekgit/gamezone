import ExitClient from "./ui/ExitClient";

export const dynamic = "force-dynamic";

export default function Page({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams?.token || "";
  return <ExitClient token={token} />;
}