"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { CommunityProvider } from "@/lib/community-context";
import { TestsProvider } from "@/lib/tests-context";
import { LanguageProvider } from "@/lib/language-context";
import { NotificationProvider } from "@/lib/notification-context";
import { checkAndPurgeOutdatedStorage } from "@/lib/storage-version";

export function Providers({ children }: { children: React.ReactNode }) {
  // Purge outdated storage/caches before React providers mount
  if (typeof window !== "undefined") {
    checkAndPurgeOutdatedStorage();
  }

  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <NotificationProvider>
            <CommunityProvider>
              <TestsProvider>
                {children}
              </TestsProvider>
            </CommunityProvider>
          </NotificationProvider>
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
