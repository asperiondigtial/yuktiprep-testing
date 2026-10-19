"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTests, Test } from "@/lib/tests-context";
import { cn } from "@/lib/utils";
import {
  ClipboardCheck,
  Clock,
  CircleHelp,
  Users,
  ChevronDown,
  Sparkles,
  Lock,
  Zap,
  ArrowUpRight,
  AlertCircle,
  BookOpen,
  PenTool,
  UserCheck,
} from "lucide-react";
import { Poppins } from "next/font/google";
import { Button } from "@/components/ui/button";
import { Mains360Container } from "@/components/mains360/Mains360Container";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

type TopTab = "available" | "mains360" | "attempts";
type CategoryTab = "all" | "mock" | "previous-year";

const EXAM_OPTIONS = [
  "All Exams",
  "UPSC Civil Services",
];

const DIFFICULTY_OPTIONS = [
  "All Difficulties",
  "EASY",
  "MEDIUM",
  "HARD",
];

const CATEGORY_TABS: { label: string; value: CategoryTab }[] = [
  { label: "All Tests", value: "all" },
  { label: "Mock Tests", value: "mock" },
  { label: "Previous Year", value: "previous-year" },
];

const DIFFICULTY_STYLES: Record<string, { background: string; text: string }> = {
  EASY: { background: "#E4F6EE", text: "#27805F" },
  MEDIUM: { background: "#FFF4D7", text: "#C68A17" },
  HARD: { background: "#FDEBEC", text: "#C64E56" },
};

const DifficultyBadge = ({ difficulty }: { difficulty: string }) => {
  const style = DIFFICULTY_STYLES[difficulty] || { background: "#F3F4F6", text: "#374151" };
  return (
    <span
      className="rounded-full w-fit px-2 py-1 text-xs font-semibold"
      style={{ background: style.background, color: style.text }}
    >
      {difficulty}
    </span>
  );
};

const TestMetadata = ({
  icon: Icon,
  value,
}: {
  icon: React.ElementType;
  value: string;
}) => (
  <div className="flex items-center gap-1.5 text-xs text-[#647084]">
    <Icon className="h-4 w-4" />
    <span>{value}</span>
  </div>
);

interface TestCardProps {
  test: Test;
  isLocked: boolean;
  onStart: (test: Test) => void;
  onUpgrade: () => void;
}

const TestCard = ({ test, isLocked, onStart, onUpgrade }: TestCardProps) => {
  return (
    <article
      className="rounded-[20px] border border-[#E2E6EE] bg-white p-[18px] shadow-sm transition hover:shadow-md"
      style={{ marginBottom: "16px" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]",
              isLocked ? "bg-amber-50" : "bg-[#FFF6D9]"
            )}
          >
            {isLocked ? (
              <Lock className="h-6 w-6 text-amber-600" />
            ) : (
              <ClipboardCheck className="h-6 w-6 text-[#E5A326]" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <DifficultyBadge difficulty={test.difficulty} />
              {test.type === "mock" && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                  Full Mock
                </span>
              )}
            </div>
            <span className="text-xs text-[#647084]">{test.exam}</span>
          </div>
        </div>

        {isLocked && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-800">
            Quota Limit Reached
          </span>
        )}
      </div>

      <h3 className="mt-3 text-base font-semibold text-[#1F314D]">{test.title}</h3>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <TestMetadata icon={Clock} value={test.duration} />
        <TestMetadata icon={CircleHelp} value={test.questions} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#647084]">
          {isLocked ? "Upgrade Plan" : "Ready to Start"}
        </span>
        {isLocked ? (
          <Button
            onClick={onUpgrade}
            className="h-10 rounded-xl bg-amber-600 px-5 text-sm font-semibold text-white transition hover:bg-amber-700"
          >
            Upgrade Plan <ArrowUpRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={() => onStart(test)}
            className="h-10 rounded-xl bg-[#6650D8] px-5 text-sm font-semibold text-white transition hover:bg-[#5843C4]"
          >
            Start Test
          </Button>
        )}
      </div>
    </article>
  );
};

export const TestsPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    tests,
    attempts,
    quotaStatus,
    isLoadingQuota,
    filters,
    setExamFilter,
    setDifficultyFilter,
  } = useTests();

  const urlTab = searchParams.get("tab") as TopTab | null;
  const urlSubTab = searchParams.get("subtab") as "simulator" | "analytics" | null;
  const urlCategory = searchParams.get("category") as CategoryTab | null;

  const [topTab, setTopTab] = useState<TopTab>(
    urlTab === "mains360" || urlTab === "attempts" || urlTab === "available"
      ? urlTab
      : "available"
  );

  const [categoryTab, setCategoryTab] = useState<CategoryTab>(
    urlCategory === "mock" || urlCategory === "previous-year" || urlCategory === "all"
      ? urlCategory
      : "all"
  );

  useEffect(() => {
    if (urlTab === "mains360" || urlTab === "attempts" || urlTab === "available") {
      setTopTab(urlTab);
    }
  }, [urlTab]);

  useEffect(() => {
    if (urlCategory === "mock" || urlCategory === "previous-year" || urlCategory === "all") {
      setCategoryTab(urlCategory);
    }
  }, [urlCategory]);
  const [showQuotaModal, setShowQuotaModal] = useState(false);

  const isMockQuotaExhausted = Boolean(
    quotaStatus && !quotaStatus.allowed && !quotaStatus.isAdmin
  );

  const filteredTests = useMemo(() => {
    return tests.filter((test) => {
      const matchesExam = filters.exam === "All Exams" || test.exam === filters.exam;
      const matchesDifficulty = filters.difficulty === "All Difficulties" || test.difficulty === filters.difficulty;
      const matchesCategory = categoryTab === "all" || test.type === categoryTab;
      return matchesExam && matchesDifficulty && matchesCategory;
    });
  }, [tests, filters, categoryTab]);

  const handleStartTest = (test: Test) => {
    if (test.type === "mock" && isMockQuotaExhausted) {
      setShowQuotaModal(true);
      return;
    }
    router.push(`/tests/${test.id}`);
  };

  const handleUpgradeClick = () => {
    router.push("/plans");
  };

  const handleAttemptClick = (attemptId: string) => {
    router.push(`/tests/result/${attemptId}`);
  };

  return (
    <main
      className={`${poppins.variable} flex flex-1 flex-col min-w-0 h-full overflow-y-auto rounded-tl-2xl border border-neutral-200 bg-[#F4F6FA] p-5 shadow-sm md:p-8 lg:p-10 font-poppins`}
    >
      <div className="mx-auto w-full max-w-[1200px]">
        <section className="mt-2 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#DDF3F5]">
            <ClipboardCheck className="h-6 w-6 text-[#0F7F8C]" />
          </div>
          <h1 className="text-[28px] font-semibold text-[#1F314D] md:text-[32px]">Tests</h1>
        </section>

        <section className="mt-5">
          <div className="flex rounded-[26px] border border-[#E2E6EE] bg-white p-1">
            {[
              { label: "Available Tests", value: "available" },
              { label: 'Main 360', value: "mains360" },
              { label: "Recent Attempts", value: "attempts" },
            ].map((tab) => {
              const isActive = topTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setTopTab(tab.value as TopTab)}
                  className={cn(
                    "flex-1 rounded-[20px] py-2.5 text-sm font-medium transition",
                    isActive
                      ? "bg-[#233249] text-white"
                      : "text-[#1F314D] hover:bg-gray-50"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </section>

        {topTab === "available" && (
          <>
            {/* Quota Overview Card */}
            {quotaStatus && (
              <section className="mt-5 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-white p-5 shadow-xs">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold tracking-wide uppercase text-indigo-700">
                          {quotaStatus.tier} PLAN
                        </span>
                        {quotaStatus.isAdmin && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            UNLIMITED
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-semibold text-[#1F314D]">
                        Full Mock Tests Quota
                      </h3>
                      <p className="text-xs text-[#647084]">
                        {quotaStatus.isAdmin
                          ? "You have full administrator access to all mock tests."
                          : quotaStatus.tier === "PREMIUM"
                            ? `Fair-use policy: Up to 3 full tests per week (${quotaStatus.used}/3 used in current 7-day window)`
                            : `Plan allocation: ${quotaStatus.limit} full test${quotaStatus.limit > 1 ? "s" : ""} per month (${quotaStatus.used}/${quotaStatus.limit} completed)`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {!quotaStatus.isAdmin && (
                      <div className="text-right">
                        <div className="text-sm font-bold text-[#1F314D]">
                          {quotaStatus.remaining} remaining
                        </div>
                        <div className="text-[11px] text-[#647084]">
                          {quotaStatus.window === "weekly" ? "Rolling weekly quota" : "Resets next month"}
                        </div>
                      </div>
                    )}
                    {quotaStatus.tier !== "PREMIUM" && !quotaStatus.isAdmin && (
                      <Button
                        onClick={handleUpgradeClick}
                        className="h-9 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 text-xs font-semibold text-white shadow-xs hover:from-indigo-700 hover:to-purple-700"
                      >
                        <Zap className="mr-1.5 h-3.5 w-3.5 fill-current" />
                        Upgrade Plan
                      </Button>
                    )}
                  </div>
                </div>

                {!quotaStatus.isAdmin && (
                  <div className="mt-3.5">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-indigo-100">
                      <div
                        className={cn(
                          "h-full transition-all duration-300",
                          quotaStatus.remaining === 0 ? "bg-amber-500" : "bg-indigo-600"
                        )}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((quotaStatus.used / (quotaStatus.limit || 1)) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </section>
            )}

            <section className="mt-5">
              <h2 className="text-lg font-semibold text-[#1F314D]">Mock Tests & Practice</h2>
              <p className="mt-1 text-sm text-[#647084]">Test your readiness with exam-simulated environments.</p>
            </section>

            <section className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <select
                    value={filters.exam}
                    onChange={(e) => setExamFilter(e.target.value)}
                    className="appearance-none rounded-xl border border-[#E2E6EE] bg-white px-4 py-2.5 pr-10 text-sm font-medium text-[#1F314D] outline-none transition focus:border-[#0F7F8C]"
                  >
                    {EXAM_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#647084]" />
                </div>

                <div className="relative">
                  <select
                    value={filters.difficulty}
                    onChange={(e) => setDifficultyFilter(e.target.value)}
                    className="appearance-none rounded-xl border border-[#E2E6EE] bg-white px-4 py-2.5 pr-10 text-sm font-medium text-[#1F314D] outline-none transition focus:border-[#0F7F8C]"
                  >
                    {DIFFICULTY_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#647084]" />
                </div>
              </div>

              {/* Stage Navigation: Prelims, Mains, Personal Interview */}
              <div className="flex items-center gap-1.5 rounded-2xl border border-[#E2E6EE] bg-white p-1 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setTopTab("available")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                    topTab === "available"
                      ? "bg-[#1F314D] text-white shadow-xs"
                      : "text-[#647084] hover:bg-neutral-100 hover:text-[#1F314D]"
                  )}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Prelims</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTopTab("mains360");
                    router.push("/tests?tab=mains360");
                  }}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-[#647084] hover:bg-neutral-100 hover:text-[#1F314D] transition"
                >
                  <PenTool className="h-3.5 w-3.5" />
                  <span>Mains</span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/personal-test")}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-[#647084] hover:bg-neutral-100 hover:text-[#1F314D] transition"
                >
                  <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Personal Interview</span>
                </button>
              </div>
            </section>

            <section className="mt-4">
              <div className="flex rounded-[26px] border border-[#E2E6EE] bg-white p-1">
                {CATEGORY_TABS.map((tab) => {
                  const isActive = categoryTab === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setCategoryTab(tab.value)}
                      className={cn(
                        "flex-1 rounded-[20px] py-2 text-sm font-medium transition",
                        isActive
                          ? "bg-[#233249] text-white"
                          : "text-[#1F314D] hover:bg-gray-50"
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-5">
              {filteredTests.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-[#E2E6EE] bg-white p-10 text-center">
                  <p className="text-sm text-[#647084]">No tests found matching your filters.</p>
                </div>
              ) : (
                filteredTests.map((test) => {
                  const isLocked = test.type === "mock" && isMockQuotaExhausted;
                  return (
                    <TestCard
                      key={test.id}
                      test={test}
                      isLocked={isLocked}
                      onStart={handleStartTest}
                      onUpgrade={handleUpgradeClick}
                    />
                  );
                })
              )}
            </section>
          </>
        )}

        {topTab === "mains360" && (
          <section className="mt-5">
            <Mains360Container initialSubTab={urlSubTab || undefined} />
          </section>
        )}

        {topTab === "attempts" && (
          <section className="mt-5">
            {attempts.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-[#E2E6EE] bg-white p-10 text-center">
                <p className="text-sm text-[#647084]">No attempts yet. Start a test to see your results here.</p>
              </div>
            ) : (
              attempts.map((attempt) => (
                <article
                  key={attempt.id}
                  onClick={() => handleAttemptClick(attempt.id)}
                  className="cursor-pointer rounded-[20px] border border-[#E2E6EE] bg-white p-5 shadow-sm transition hover:shadow-md"
                  style={{ marginBottom: "16px" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#FFF6D9]">
                        <ClipboardCheck className="h-6 w-6 text-[#E5A326]" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-[#1F314D]">{attempt.title}</h3>
                        <p className="text-xs text-[#647084]">{attempt.exam}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#233249] px-3 py-1 text-xs font-semibold text-white">
                      {attempt.badge}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-[#0F7F8C]">{attempt.score}</span>
                      <span className="text-xs text-[#647084]">{attempt.correct}</span>
                    </div>
                    <span className="text-xs text-[#647084]">{attempt.status}</span>
                    <span className="text-xs text-[#647084]">{attempt.date}</span>
                  </div>
                </article>
              ))
            )}
          </section>
        )}

        {/* Quota Exceeded Modal */}
        {showQuotaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                <AlertCircle className="h-6 w-6" />
              </div>

              <h3 className="mt-4 text-xl font-bold text-[#1F314D]">
                Mock Test Limit Reached
              </h3>

              <p className="mt-2 text-sm text-[#647084]">
                {quotaStatus?.tier === "PREMIUM"
                  ? "You have utilized your weekly fair-use quota of 3 mock tests. Quotas refresh every 7 days."
                  : quotaStatus?.tier === "BASIC"
                    ? "You have completed your 10 mock tests for this month. Upgrade to Premium for unlimited test practice and AI evaluations!"
                    : "You have used your 1 free mock test for this month. Upgrade to Basic (10 tests/month) or Premium (unlimited tests) to keep practicing!"}
              </p>

              <div className="mt-6 flex flex-col gap-2.5">
                <Button
                  onClick={handleUpgradeClick}
                  className="h-11 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-sm font-semibold text-white hover:from-indigo-700 hover:to-purple-700"
                >
                  View Subscription Plans
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowQuotaModal(false)}
                  className="h-11 w-full rounded-xl border-[#E2E6EE] text-sm font-medium text-[#1F314D]"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="h-6" />
      </div>
    </main>
  );
};

export default TestsPage;
