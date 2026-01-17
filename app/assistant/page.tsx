import { redirect } from "next/navigation";

export default function AssistantRoot() {
  // Your assistant login page route
  // If you already have /assistant/login UI, just redirect there:
  redirect("/assistant/login");
}