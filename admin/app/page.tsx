"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAdminMe } from "@/hooks/useAdminAuth";
import { KpiCard } from "@/components/ui/kpicard";
import { Button } from "@/components/ui/button";
import {
  Users,
  CreditCard,
  Layers,
  Sparkles,
  Newspaper,
  Languages,
  Package,
  IndianRupee,
  Cpu,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  ArrowRight,
  ChevronRight,
  Plus,
  ShieldCheck,
  Zap,
  Activity,
  Globe,
  Lock,
  ExternalLink,
  BookOpen,
} from "lucide-react";

export default function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const { data: admin } = useAdminMe();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1. Users query
  const {
    data: usersData,
    isLoading: loadingUsers,
    isRefetching: refetchingUsers,
  } = useQuery({
    queryKey: ["dashboard-users"],
    queryFn: async () => {
      const res = await api.get("/api/v1/admin/users", {
        params: { page: 1, limit: 5 },
      });
      return res.data?.data || { users: [], pagination: { total: 0 } };
    },
  });

  // 2. Payments query
  const {
    data: paymentsData,
    isLoading: loadingPayments,
    isRefetching: refetchingPayments,
  } = useQuery({
    queryKey: ["dashboard-payments"],
    queryFn: async () => {
      const res = await api.get("/api/v1/admin/payments", {
        params: { page: 1, limit: 5 },
      });
      return {
        payments: res.data?.data || [],
        meta: res.data?.meta || { total: 0, totalRevenue: 0 },
      };
    },
  });

  // 3. Plans query
  const {
    data: plansData,
    isLoading: loadingPlans,
    isRefetching: refetchingPlans,
  } = useQuery({
    queryKey: ["dashboard-plans"],
    queryFn: async () => {
      const res = await api.get("/api/v1/admin/plans");
      return res.data?.data || [];
    },
  });

  // 4. AI Metering query
  const {
    data: aiMeteringData,
    isLoading: loadingAiMetering,
    isRefetching: refetchingAiMetering,
  } = useQuery({
    queryKey: ["dashboard-ai-metering"],
    queryFn: async () => {
      const res = await api.get("/api/v1/admin/ai-metering/analytics");
      return res.data?.data || null;
    },
  });

  // 5. Current Affairs query
  const {
    data: currentAffairsData,
    isLoading: loadingCA,
    isRefetching: refetchingCA,
  } = useQuery({
    queryKey: ["dashboard-current-affairs"],
    queryFn: async () => {
      const res = await api.get("/api/v1/admin/current-affairs", {
        params: { page: 1, limit: 5 },
      });
      return {
        items: res.data?.data || [],
        meta: res.data?.meta || { total: 0 },
      };
    },
  });

  // 6. Languages query
  const {
    data: languagesData,
    isLoading: loadingLanguages,
    isRefetching: refetchingLanguages,
  } = useQuery({
    queryKey: ["dashboard-languages"],
    queryFn: async () => {
      const res = await api.get("/api/v1/admin/languages");
      return res.data?.data?.languages || res.data?.data || [];
    },
  });

  // 7. Exam Groups query
  const {
    data: examGroupsData,
    isLoading: loadingExamGroups,
    isRefetching: refetchingExamGroups,
  } = useQuery({
    queryKey: ["dashboard-exam-groups"],
    queryFn: async () => {
      const res = await api.get("/api/v1/admin/exam-groups");
      return res.data?.data || [];
    },
  });

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ["dashboard-users"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-payments"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-plans"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-ai-metering"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-current-affairs"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-languages"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-exam-groups"] }),
    ]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const isGlobalLoading =
    isRefreshing ||
    refetchingUsers ||
    refetchingPayments ||
    refetchingPlans ||
    refetchingAiMetering ||
    refetchingCA ||
    refetchingLanguages ||
    refetchingExamGroups;

  // Format currency
  const formatRevenue = (paiseOrRupees: number) => {
    if (!paiseOrRupees) return "₹0";
    const isPaise = paiseOrRupees >= 1000 && paiseOrRupees % 100 === 0;
    const val = isPaise ? paiseOrRupees / 100 : paiseOrRupees;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Format tokens
  const formatTokens = (tokens: number) => {
    if (!tokens) return "0";
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
    return tokens.toLocaleString("en-IN");
  };

  // Calculations
  const totalUsers = usersData?.pagination?.total ?? 0;
  const lockedUsersCount =
    usersData?.users?.filter((u: any) => u.locked).length || 0;

  const totalRevenue = paymentsData?.meta?.totalRevenue ?? 0;
  const totalPaymentsCount = paymentsData?.meta?.total ?? 0;
  const recentPayments = paymentsData?.payments || [];

  const activePlansCount =
    plansData?.filter((p: any) => p.isActive !== false).length ||
    plansData?.length ||
    0;

  const totalAiTokens = aiMeteringData?.totalTokens ?? 0;
  const aiCostRupees = aiMeteringData?.totalCostRupees ?? 0;
  const totalAiRequests = aiMeteringData?.totalRequests ?? 0;

  const totalCurrentAffairs = currentAffairsData?.meta?.total ?? 0;
  const recentArticles = currentAffairsData?.items || [];

  const languagesList = Array.isArray(languagesData)
    ? languagesData
    : Array.isArray(languagesData?.languages)
      ? languagesData.languages
      : [];
  const activeLanguagesCount = languagesList.filter(
    (l: any) => l.isActive !== false
  ).length;

  const examGroups = Array.isArray(examGroupsData) ? examGroupsData : [];
  const activeExamGroupsCount = examGroups.filter(
    (g: any) => g.isActive !== false
  ).length;
  const totalExamOptionsCount = examGroups.reduce(
    (acc: number, g: any) => acc + (g._count?.examOptions || g.examOptions?.length || 0),
    0
  );

  return (
    <div className="space-y-8 pb-10">
      {/* Top Banner / Welcome Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-neutral-200/80 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center h-9 w-9 rounded-xl bg-white border border-neutral-200/80 shadow-xs shrink-0 overflow-hidden p-1">
              <Image
                src="/yuktiprep.png"
                alt="Yuktiprep Logo"
                width={28}
                height={28}
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-neutral-900">
              Yuktiprep Command Center
            </h1>
          </div>
          <p className="text-sm text-neutral-500">
            Welcome back, <span className="font-semibold text-neutral-800">{admin?.name || "Admin"}</span>. Real-time telemetry, user accounts, subscription billing, and AI workloads.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isGlobalLoading}
            className="flex items-center gap-1.5 bg-white text-neutral-700 shadow-xs hover:bg-neutral-50"
          >
            <RefreshCw
              className={`h-4 w-4 text-teal-600 ${isGlobalLoading ? "animate-spin" : ""
                }`}
            />
            <span>Refresh Telemetry</span>
          </Button>
        </div>
      </div>

      {/* Primary KPI Grid (7 core items: Users, Payments, Plans, AI Tokens, Current Affairs, Languages, Exam Groups) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Payments & Revenue */}
        <KpiCard
          title="Revenue & Volume"
          value={formatRevenue(totalRevenue)}
          subValue={`${totalPaymentsCount} txns`}
          icon={<IndianRupee className="h-5 w-5" />}
          iconBg="bg-emerald-50 text-emerald-600 border-emerald-100"
          badge={{ text: "Razorpay Active", variant: "emerald" }}
          href="/payments"
          linkText="View all payments"
          isLoading={loadingPayments}
        />

        {/* 2. Registered Users */}
        <KpiCard
          title="Registered Users"
          value={totalUsers.toLocaleString("en-IN")}
          subValue={lockedUsersCount > 0 ? `${lockedUsersCount} locked` : "100% active"}
          icon={<Users className="h-5 w-5" />}
          iconBg="bg-blue-50 text-blue-600 border-blue-100"
          badge={{ text: "Learner Base", variant: "info" }}
          href="/users"
          linkText="Manage user directory"
          isLoading={loadingUsers}
        />

        {/* 3. AI Tokens Metered */}
        <KpiCard
          title="AI Tokens Consumed"
          value={formatTokens(totalAiTokens)}
          subValue={`₹${aiCostRupees.toFixed(2)} cost`}
          icon={<Sparkles className="h-5 w-5" />}
          iconBg="bg-purple-50 text-purple-600 border-purple-100"
          badge={{ text: `${totalAiRequests} calls`, variant: "purple" }}
          href="/intelligence"
          linkText="AI telemetry & intelligence"
          isLoading={loadingAiMetering}
        />

        {/* 4. Active Subscription Plans */}
        <KpiCard
          title="Subscription Plans"
          value={`${activePlansCount} Active`}
          subValue="Monthly & Yearly"
          icon={<Package className="h-5 w-5" />}
          iconBg="bg-amber-50 text-amber-600 border-amber-100"
          badge={{ text: "Pricing Live", variant: "warning" }}
          href="/plans"
          linkText="Configure pricing & tiers"
          isLoading={loadingPlans}
        />

        {/* 5. Exam Groups & Categories */}
        <KpiCard
          title="Active Exam Groups"
          value={`${activeExamGroupsCount} Groups`}
          subValue={`${totalExamOptionsCount} sub-options`}
          icon={<Layers className="h-5 w-5" />}
          iconBg="bg-teal-50 text-teal-600 border-teal-100"
          badge={{ text: "Target Exams", variant: "neutral" }}
          href="/exam-groups"
          linkText="Manage exam categories"
          isLoading={loadingExamGroups}
        />

        {/* 6. Current Affairs Pipeline */}
        <KpiCard
          title="Current Affairs"
          value={`${totalCurrentAffairs} Items`}
          subValue="Daily Editorial"
          icon={<Newspaper className="h-5 w-5" />}
          iconBg="bg-indigo-50 text-indigo-600 border-indigo-100"
          badge={{ text: "Editorial Active", variant: "info" }}
          href="/current-affairs"
          linkText="Current affairs feed"
          isLoading={loadingCA}
        />

        {/* 7. Multilingual Engine / Languages */}
        <KpiCard
          title="Supported Languages"
          value={`${activeLanguagesCount || languagesList.length} Active`}
          subValue="Indic & English"
          icon={<Languages className="h-5 w-5" />}
          iconBg="bg-rose-50 text-rose-600 border-rose-100"
          badge={{ text: "Multi-Language", variant: "neutral" }}
          href="/languages"
          linkText="Language preferences"
          isLoading={loadingLanguages}
        />

        {/* 8. System Automations & Cron */}
        <KpiCard
          title="System Automations"
          value="Operational"
          subValue="Cron & Schedulers"
          icon={<Clock className="h-5 w-5" />}
          iconBg="bg-teal-50 text-teal-600 border-teal-100"
          badge={{ text: "Cron Active", variant: "emerald" }}
          href="/settings"
          linkText="Manage cron jobs"
        />
      </div>

      {/* Balanced 2-Column Analytics & Management Grid */}
      <div className="space-y-6">
        {/* Row 1: AI Metering & Question Intelligence Hub */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* AI Workload & Token Metering Widget */}
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">
                      AI Token Consumption & Metering
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Real-time prompt vs. completion distribution and platform cost
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                  <Sparkles className="w-3.5 h-3.5" />
                  Gemini Metering
                </span>
              </div>

              {loadingAiMetering ? (
                <div className="space-y-3 py-6">
                  <div className="h-4 bg-neutral-100 rounded-full animate-pulse w-3/4" />
                  <div className="h-4 bg-neutral-100 rounded-full animate-pulse w-1/2" />
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Stats Bar */}
                  <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-neutral-50/80 border border-neutral-200/60 text-center">
                    <div>
                      <span className="text-[11px] font-medium text-neutral-500 uppercase">
                        Prompt Tokens
                      </span>
                      <p className="text-lg font-bold text-neutral-900 mt-0.5">
                        {formatTokens(aiMeteringData?.totalPromptTokens || 0)}
                      </p>
                    </div>
                    <div className="border-x border-neutral-200">
                      <span className="text-[11px] font-medium text-neutral-500 uppercase">
                        Completion
                      </span>
                      <p className="text-lg font-bold text-purple-700 mt-0.5">
                        {formatTokens(aiMeteringData?.totalCompletionTokens || 0)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] font-medium text-neutral-500 uppercase">
                        Total AI Spend
                      </span>
                      <p className="text-lg font-bold text-emerald-600 mt-0.5">
                        ₹{(aiMeteringData?.totalCostRupees || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Feature split progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium text-neutral-700">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                        AI Tutor: {aiMeteringData?.featureBreakdown?.ai_tutor || 0} requests
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                        Study Planner: {aiMeteringData?.featureBreakdown?.study_plan || 0} requests
                      </span>
                    </div>
                    <div className="w-full h-3 bg-neutral-100 rounded-full overflow-hidden flex">
                      <div
                        className="bg-purple-500 h-full transition-all duration-500"
                        style={{
                          width: `${totalAiRequests > 0
                            ? ((aiMeteringData?.featureBreakdown?.ai_tutor || 0) /
                              totalAiRequests) *
                            100
                            : 50
                            }%`,
                        }}
                      />
                      <div
                        className="bg-teal-500 h-full transition-all duration-500"
                        style={{
                          width: `${totalAiRequests > 0
                            ? ((aiMeteringData?.featureBreakdown?.study_plan || 0) /
                              totalAiRequests) *
                            100
                            : 50
                            }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
              <span className="text-xs text-neutral-500">
                Tracked across Gemini 1.5 Pro & Flash models
              </span>
              <Link
                href="/intelligence"
                className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1"
              >
                Detailed Logs <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Dedicated Question Intelligence Hub Card */}
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                      Question Intelligence Hub
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active Pipeline
                      </span>
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Official source ingestion, automated question extraction & TeX review
                    </p>
                  </div>
                </div>

                <Link href="/intelligence">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 border-purple-200 font-semibold gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Launch Hub
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3.5 rounded-xl border border-neutral-200/70 bg-neutral-50/50">
                  <div className="text-xs font-semibold text-neutral-800">1. Document Ingestion</div>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Upload official exam notifications & PDFs or web URLs.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-neutral-200/70 bg-neutral-50/50">
                  <div className="text-xs font-semibold text-neutral-800">2. AI Question Extractor</div>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Automated parsing into MCQs & Mains with LaTeX TeX.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-neutral-200/70 bg-neutral-50/50">
                  <div className="text-xs font-semibold text-neutral-800">3. Verification & Live</div>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Review drafts, approve solutions, and publish live.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
              <span className="text-xs text-neutral-500">
                Supports Prelims, Mains, and Subject syllabus tagging.
              </span>
              <Link
                href="/intelligence"
                className="text-xs font-semibold text-neutral-700 hover:text-purple-700 flex items-center gap-1 transition"
              >
                <span>Manage Ingested Sources & Drafts</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Row 2: Recent Transactions & Active Exam Groups */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Recent Payments Stream */}
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">
                      Recent Transactions
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Latest Razorpay payments and subscriptions
                    </p>
                  </div>
                </div>
                <Link
                  href="/payments"
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                >
                  View All <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {loadingPayments ? (
                <div className="space-y-3 py-4">
                  <div className="h-12 bg-neutral-100 rounded-lg animate-pulse" />
                  <div className="h-12 bg-neutral-100 rounded-lg animate-pulse" />
                  <div className="h-12 bg-neutral-100 rounded-lg animate-pulse" />
                </div>
              ) : recentPayments.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500">
                  No payment transactions logged yet.
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {recentPayments.slice(0, 4).map((p: any) => (
                    <div
                      key={p.id}
                      className="py-2.5 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5 truncate pr-2">
                        <div className="font-semibold text-neutral-900 flex items-center gap-1.5">
                          <span>{p.user?.name || "Customer"}</span>
                          <span className="font-normal text-neutral-400 font-mono text-[11px]">
                            {p.razorpayPaymentId ? `#${p.razorpayPaymentId.slice(-8)}` : ""}
                          </span>
                        </div>
                        <div className="text-neutral-500 truncate">
                          {p.plan?.name || "Premium Plan"} •{" "}
                          <span className="capitalize">{p.method || "card/upi"}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-bold text-neutral-900">
                          {formatRevenue(p.amount)}
                        </div>
                        <span
                          className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold mt-0.5 ${p.status === "captured" || p.status === "success"
                            ? "bg-emerald-50 text-emerald-700"
                            : p.status === "pending"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-rose-50 text-rose-700"
                            }`}
                        >
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-100">
              <Link
                href="/payments"
                className="w-full py-2 px-3 rounded-lg bg-neutral-50 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <span>Audit All Razorpay Transactions</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Active Exam Groups & Categories Overview */}
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-teal-50 text-teal-600 border border-teal-100">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">
                      Active Exam Categories & Groups
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Hierarchy of syllabus, target exams, and registered learner enrollment
                    </p>
                  </div>
                </div>
                <Link
                  href="/exam-groups"
                  className="text-xs font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1"
                >
                  Manage All ({examGroups.length}) <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {loadingExamGroups ? (
                <div className="space-y-2 py-4">
                  <div className="h-10 bg-neutral-100 rounded-lg animate-pulse" />
                  <div className="h-10 bg-neutral-100 rounded-lg animate-pulse" />
                </div>
              ) : examGroups.length === 0 ? (
                <div className="py-6 text-center text-xs text-neutral-500">
                  No exam groups configured yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {examGroups.slice(0, 4).map((group: any) => (
                    <div
                      key={group.id}
                      className="p-3.5 rounded-xl border border-neutral-200/70 bg-neutral-50/50 hover:bg-neutral-50 transition flex items-center justify-between"
                    >
                      <div className="space-y-0.5 truncate pr-2">
                        <p className="font-semibold text-sm text-neutral-900 truncate">
                          {group.name}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {group._count?.examOptions || 0} sub-options •{" "}
                          <span className="text-teal-700 font-medium">
                            {group._count?.users || 0} learners
                          </span>
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${group.isActive !== false
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-neutral-100 text-neutral-600"
                          }`}
                      >
                        {group.isActive !== false ? "Active" : "Inactive"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-100">
              <Link
                href="/exam-groups"
                className="w-full py-2 px-3 rounded-lg bg-neutral-50 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <span>Configure Syllabus & Exam Mappings</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Row 3: Supported Languages & Administrative Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Languages & Multilingual Status */}
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                    <Languages className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">
                      Supported Languages
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Localization & translation dictionary
                    </p>
                  </div>
                </div>
                <Link
                  href="/languages"
                  className="text-xs font-semibold text-rose-700 hover:text-rose-900"
                >
                  Manage
                </Link>
              </div>

              {loadingLanguages ? (
                <div className="h-10 bg-neutral-100 rounded-lg animate-pulse" />
              ) : languagesList.length === 0 ? (
                <div className="py-4 text-center text-xs text-neutral-500">
                  No languages loaded yet.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {languagesList.map((lang: any) => (
                    <span
                      key={lang.id || lang.code}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${lang.isActive
                        ? "bg-white text-neutral-900 border-neutral-300 shadow-xs"
                        : "bg-neutral-100/70 text-neutral-500 border-neutral-200"
                        }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${lang.isActive ? "bg-emerald-500" : "bg-neutral-300"
                          }`}
                      />
                      <span>{lang.englishName || lang.code}</span>
                      {lang.nativeName && (
                        <span className="text-neutral-400 text-[11px]">
                          ({lang.nativeName})
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
              <span className="text-xs text-neutral-500">
                Active in translation engine and learner UI preference
              </span>
              <Link
                href="/languages"
                className="text-xs font-semibold text-rose-700 hover:text-rose-900 flex items-center gap-1"
              >
                Configure <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Quick Action Command Center */}
          <div className="rounded-2xl border bg-white border-neutral-200/80 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Administrative Quick Actions
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Quick navigation to primary management workflows
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <Link href="/exam-groups">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border-neutral-200 justify-start py-2.5"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
                    New Exam Category
                  </Button>
                </Link>

                <Link href="/current-affairs">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border-neutral-200 justify-start py-2.5"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
                    New Current Affair
                  </Button>
                </Link>

                <Link href="/plans">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border-neutral-200 justify-start py-2.5"
                  >
                    <CreditCard className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
                    Pricing & Plans
                  </Button>
                </Link>

                <Link href="/users">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs bg-teal-50 hover:bg-teal-100 text-teal-800 border-teal-200 font-semibold justify-start py-2.5"
                  >
                    <Users className="w-3.5 h-3.5 mr-1.5 text-teal-700" />
                    User Directory
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
              <span className="text-xs text-neutral-500">
                Shortcuts for admin management tasks
              </span>
              <span className="text-xs font-medium text-amber-700">
                Instant Access
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
