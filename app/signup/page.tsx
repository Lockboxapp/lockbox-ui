// app/signup/page.tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

import SignUpForm from "./SignUpForm"; // your existing signup client form

export default async function SignUpPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/");
  }
  return <SignUpForm />;
}
