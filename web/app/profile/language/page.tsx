"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/lib/language-context";
import { api } from "@/lib/api";
import { ChevronLeft, Check, Sparkles, ArrowRight } from "lucide-react";

interface Language {
  id: string;
  code: string;
  englishName: string;
  nativeName: string;
  isActive: boolean;
}

export default function LanguageSettingsPage() {
  const { t, language: currentLanguage, setLanguage } = useLanguage();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [userTier, setUserTier] = useState<string>("FREE");
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(() => currentLanguage?.code || "en");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const res = await api.get("/api/v1/languages/languages");
        setLanguages(res?.data?.languages || []);
        if (res?.data?.userTier) {
          setUserTier(res.data.userTier);
        }

        const prefRes = await api.get("/api/v1/languages/profile/language");
        if (prefRes?.data?.preference?.language?.code) {
          setSelectedLanguage(prefRes.data.preference.language.code);
        } else {
          setSelectedLanguage("en");
        }
      } catch (err) {
        setError("Failed to load languages");
      } finally {
        setLoading(false);
      }
    };

    fetchLanguages();
  }, []);

  const handleSelectLanguage = async (languageCode: string) => {
    setSaving(true);
    setError("");

    try {
      await api.put("/api/v1/languages/profile/language", {
        languageCode,
      });

      const selected = languages.find((l) => l.code === languageCode);
      if (selected) {
        setSelectedLanguage(languageCode);
        setLanguage(selected);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to update language");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col min-w-0 h-full overflow-y-auto rounded-tl-2xl border border-neutral-200 bg-white p-4 shadow-sm md:p-10">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#6B55D9]" />
        </div>
      </div>
    );
  }

  const isFree = userTier === "FREE";
  const isBasic = userTier === "BASIC";
  const isPremium = userTier === "PREMIUM";

  return (
    <div className="flex flex-1 flex-col min-w-0 h-full overflow-y-auto rounded-tl-2xl border border-neutral-200 bg-white p-4 shadow-sm md:p-10">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-[#647084] transition hover:text-[#1F314D]"
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#1F314D]">{t("language")}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${isPremium
                  ? "bg-amber-100 text-amber-800"
                  : isBasic
                    ? "bg-blue-100 text-blue-800"
                    : "bg-gray-100 text-gray-700"
                }`}
            >
              {userTier} Plan
            </span>
          </div>
          <p className="mt-1 text-sm text-[#647084]">
            {isPremium
              ? "You have access to all available languages."
              : isBasic
                ? "You have access to 2 languages (English and Hindi)."
                : "Free plan includes English. Upgrade to access more languages."}
          </p>
        </div>

        {!isPremium && (
          <Link
            href="/plans"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#6B55D9] to-[#8C76FF] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Unlock All Languages
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {languages.map((language) => {
          const isSelected = selectedLanguage === language.code;

          return (
            <button
              key={language.id}
              type="button"
              onClick={() => handleSelectLanguage(language.code)}
              disabled={saving || isSelected}
              className={`flex items-center gap-4 rounded-[18px] border p-5 text-left transition ${isSelected
                  ? "border-[#6B55D9] bg-[#F3F0FF]"
                  : "border-[#E2E6EE] bg-white hover:border-[#6B55D9] hover:shadow-md"
                }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-[#1F314D]">
                  {language.englishName}
                </p>
                <p className="mt-1 text-sm text-[#647084]">
                  {language.nativeName}
                </p>
              </div>

              {isSelected && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#6B55D9]">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {saving && (
        <div className="mt-6 flex items-center gap-2 text-sm text-[#647084]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-[#6B55D9]" />
          {t("saving")}
        </div>
      )}
    </div>
  );
}
