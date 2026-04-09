// app/signup/page.tsx
// Redirects all new users to the onboarding welcome screen
import { redirect } from "next/navigation";

export default function SignUpPage() {
  redirect("/welcome");
}
