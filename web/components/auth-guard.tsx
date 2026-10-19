"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isInitialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isInitialized) {
      if (!isAuthenticated) {
        router.push("/login");
      } else if (user && user.active === false) {
        router.push("/select-exam");
      }
    }
  }, [user, isAuthenticated, isInitialized, router]);

  if (!isInitialized || !isAuthenticated || (user && user.active === false)) {
    return null;
  }

  return <>{children}</>;
}
