"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      const callback = typeof window !== "undefined" ? window.location.pathname : "/";
      router.replace(`/signin?callbackUrl=${encodeURIComponent(callback)}`);
    }
  }, [status, router]);

  if (status === "loading") return null;        // or a spinner
  if (status !== "authenticated") return null;  // gate until redirect happens

  return <>{children}</>;
}
