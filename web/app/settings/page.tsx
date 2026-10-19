"use client";

import SidebarDemo from "@/components/sidebar-demo";
import AuthGuard from "@/components/auth-guard";
import { useLanguage } from "@/lib/language-context";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function SettingsPage() {
  const { t } = useLanguage();
  const router = useRouter();

  return (
    <AuthGuard>
      <div className="flex flex-col flex-1 font-sans">
        <SidebarDemo>
          <main className="flex flex-1 flex-col min-w-0 h-full overflow-y-auto rounded-tl-2xl border border-neutral-200 bg-white p-4 shadow-sm md:p-10">
            <div className="mb-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 transition hover:bg-neutral-100"
                aria-label={t("back")}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-800">{t("settings")}</h1>
            </div>
            <p className="text-neutral-600 mb-6">
              {t("settingsDescription")}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
              <a
                href="/settings/devices"
                className="flex items-center justify-between p-5 rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm transition-all group"
              >
                <div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors">
                    Active Devices
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    Manage devices logged into your account (up to 3 devices).
                  </p>
                </div>
                <span className="text-neutral-400 group-hover:translate-x-0.5 transition-transform text-lg">
                  &rarr;
                </span>
              </a>
            </div>
          </main>
        </SidebarDemo>
      </div>
    </AuthGuard>
  );
}