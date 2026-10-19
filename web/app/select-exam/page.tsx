"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { examApi, ExamGroup, ExamOption } from "@/lib/exam-api";
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  BookOpen,
  GraduationCap,
  RefreshCw,
} from "lucide-react";
import Image from "next/image";

export default function SelectExamPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, updateUser } = useAuth();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Guard check: if not authenticated -> /login; if already active -> /
  useEffect(() => {
    if (isInitialized) {
      if (!isAuthenticated) {
        router.push("/login");
      } else if (user?.active) {
        router.replace("/");
      }
    }
  }, [user?.active, isAuthenticated, isInitialized, router]);

  // 2. Fetch active exam groups and their options from backend (Zero hardcoding)
  const {
    data: examGroups = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["active-exam-groups"],
    queryFn: examApi.getActiveExamGroups,
    staleTime: 5 * 60 * 1000,
  });

  // Selected Group reference
  const selectedGroup = examGroups.find((g) => g.id === selectedGroupId) || null;
  const activeOptions = selectedGroup?.examOptions || [];

  // 3. Selection handler for Exam Group (Stage 1)
  const handleSelectGroup = (groupId: string) => {
    if (selectedGroupId === groupId) return;
    setSelectedGroupId(groupId);
    setSelectedOptionId(null); // Reset exam option to prevent cross-group invalid state
    setErrorMsg(null);
  };

  // 4. Selection handler for Exam Option (Stage 2)
  const handleSelectOption = (optionId: string) => {
    setSelectedOptionId(optionId);
    setErrorMsg(null);
  };

  // 5. Submit selection mutation
  const saveMutation = useMutation({
    mutationFn: examApi.saveExamSelection,
    onSuccess: (response: any) => {
      // Backend returns successResponse(res, msg, updatedUser) -> response.data
      const updatedUser = response?.data || response;
      if (updatedUser) {
        updateUser(updatedUser);
      }
      // Force immediate navigation to home dashboard
      window.location.href = "/";
    },
    onError: (err: any) => {
      setErrorMsg(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to save your exam selection. Please try again."
      );
    },
  });

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || !selectedOptionId) return;

    setErrorMsg(null);
    saveMutation.mutate({
      examGroupId: selectedGroupId,
      examOptionId: selectedOptionId,
    });
  };

  // Loading state
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600 animate-bounce">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Loading exam options...</h2>
          <p className="text-xs text-gray-500">Preparing personalized categories for you.</p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 p-8 text-center space-y-4 shadow-sm">
          <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Unable to load exams</h2>
          <p className="text-xs text-gray-500">
            Please check your connection or try again in a few moments.
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-all cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  // Empty state: No active exam groups in DB
  if (examGroups.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-4 shadow-sm">
          <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            <BookOpen className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">No exam options available</h2>
          <p className="text-xs text-gray-500">
            No active exam categories are currently available. Please try again later or contact support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 py-10 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Brand / Logo Top */}
        <div className="flex items-center justify-center gap-2.5">
          <Image
            src="/yuktiprep.png"
            height={44}
            width={44}
            alt="YuktiPrep"
            className="h-11 w-auto object-contain"
          />
          <span className="font-extrabold text-xl tracking-tight text-gray-900 font-sans">
            Yukti<span className="text-teal-600">Prep</span>
          </span>
        </div>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200/80 px-3 py-1 text-xs font-semibold text-teal-800 shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-teal-600" />
            <span>Welcome! 👋</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            What are you preparing for?
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 max-w-lg mx-auto">
            Select your exam category and target exam to personalize your syllabus, mock tests, and daily preparation.
          </p>
        </div>

        {/* Error notification banner if any */}
        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleContinue} className="space-y-8">
          {/* STAGE 1: Exam Group Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-slate-900 text-white text-[11px] flex items-center justify-center font-semibold">
                  1
                </span>
                Choose your exam category
              </label>
              {selectedGroup && (
                <span className="text-xs font-semibold text-teal-700">
                  Selected: {selectedGroup.name}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {examGroups.map((group) => {
                const isSelected = selectedGroupId === group.id;

                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => handleSelectGroup(group.id)}
                    className={`relative p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2.5 ${
                      isSelected
                        ? "border-teal-600 bg-teal-50/60 ring-2 ring-teal-600/20 shadow-sm"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50 shadow-xs"
                    }`}
                  >
                    {/* Selected Badge Checkmark */}
                    {isSelected && (
                      <div className="absolute top-2.5 right-2.5 text-teal-600">
                        <CheckCircle2 className="h-4 w-4 fill-teal-600 text-white" />
                      </div>
                    )}

                    {/* Logo or Dynamic Fallback */}
                    {group.logoUrl ? (
                      <img
                        src={group.logoUrl}
                        alt={group.name}
                        className="h-12 w-12 rounded-xl object-contain border border-gray-100 bg-white p-1"
                      />
                    ) : (
                      <div
                        className={`h-12 w-12 rounded-xl flex items-center justify-center font-extrabold text-base tracking-wider shadow-xs transition-colors ${
                          isSelected
                            ? "bg-teal-600 text-white"
                            : "bg-slate-900 text-white"
                        }`}
                      >
                        {group.name.slice(0, 3).toUpperCase()}
                      </div>
                    )}

                    <div>
                      <h3
                        className={`text-sm font-bold ${
                          isSelected ? "text-teal-900" : "text-gray-900"
                        }`}
                      >
                        {group.name}
                      </h3>
                      {group.description && (
                        <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
                          {group.description}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STAGE 2: Exam Options for the selected group */}
          {selectedGroup && (
            <div className="space-y-3 pt-2 transition-all">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-slate-900 text-white text-[11px] flex items-center justify-center font-semibold">
                    2
                  </span>
                  Select your exam in {selectedGroup.name}
                </label>
                <span className="text-xs text-gray-400">
                  {activeOptions.length} exams available
                </span>
              </div>

              {activeOptions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center bg-white text-xs text-gray-500">
                  No active exams found for {selectedGroup.name}. Please select another category or check back later.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeOptions.map((opt) => {
                    const isSelected = selectedOptionId === opt.id;

                    // Logo resolution: use opt.logoUrl, or fallback to selectedGroup.logoUrl, or fallback to group initials badge
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectOption(opt.id)}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? "border-teal-600 bg-teal-50/70 ring-2 ring-teal-600/20 shadow-sm"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50 shadow-xs"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Logo: option logo -> group logo -> group badge fallback */}
                          {opt.logoUrl ? (
                            <img
                              src={opt.logoUrl}
                              alt={opt.title}
                              className="h-10 w-10 rounded-xl object-contain border border-gray-100 bg-white p-1 shrink-0"
                            />
                          ) : selectedGroup.logoUrl ? (
                            <img
                              src={selectedGroup.logoUrl}
                              alt={selectedGroup.name}
                              className="h-10 w-10 rounded-xl object-contain border border-gray-100 bg-white p-1 shrink-0"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {selectedGroup.name.slice(0, 3).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0">
                            <h4
                              className={`text-xs sm:text-sm font-semibold truncate ${
                                isSelected ? "text-teal-950 font-bold" : "text-gray-900"
                              }`}
                            >
                              {opt.title}
                            </h4>
                            <span className="text-[11px] text-gray-400">
                              {selectedGroup.name}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 pl-2">
                          {isSelected ? (
                            <CheckCircle2 className="h-5 w-5 fill-teal-600 text-white" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Continue Button */}
          <div className="pt-4 border-t border-gray-200 flex flex-col items-center gap-3">
            <button
              type="submit"
              disabled={
                !selectedGroupId ||
                !selectedOptionId ||
                saveMutation.isPending
              }
              className="w-full sm:w-80 inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-teal-700 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saveMutation.isPending ? (
                <span>Saving your preferences...</span>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
