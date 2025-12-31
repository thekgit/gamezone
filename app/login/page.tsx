import { Suspense } from "react";
import LoginClient from "./ui/LoginClient";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginClient />
    </Suspense>
  );
}