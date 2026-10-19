import React, { Suspense } from "react";
import SidebarDemo from "@/components/sidebar-demo";
import AuthGuard from "@/components/auth-guard";
import { TestsPage } from "@/components/tests";

export default function Tests() {
  return (
    <AuthGuard>
      <div className="flex flex-col flex-1 font-poppins">
        <SidebarDemo>
          <Suspense fallback={<div className="flex-1 p-6 text-sm text-[#647084]">Loading Tests...</div>}>
            <TestsPage />
          </Suspense>
        </SidebarDemo>
      </div>
    </AuthGuard>
  );
}
