"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  HelpCircle,
  Search,
  CheckCircle2,
  XCircle,
  BookOpen,
  Sparkles,
  ArrowLeft,
  Calendar,
  Layers,
  ChevronRight,
  FileText,
  Lock,
  Crown,
} from "lucide-react";
import { QuestionMarkdown } from "@/components/question-markdown";

interface Option {
  id: string;
  key: string;
  text: string;
  isCorrect?: boolean;
}

interface PublishedQuestion {
  id: string;
  questionText: string;
  questionType: string;
  options?: Option[];
  correctAnswer?: string | null;
  explanation?: string | null;
  modelAnswer?: string | null;
  evaluationCriteria?: string | null;
  marks?: number | null;
  wordLimit?: number | null;
  passage?: string;
  bloomLevel?: string;
  difficulty?: string;
  sourceName?: string;
  sourceYear?: number;
  exam?: { name: string };
  subject?: { name: string };
  topic?: { name: string };
  isAnswerLocked?: boolean;
}

interface PaperGroup {
  sourceName: string;
  sourceYear?: number;
  examName: string;
  questionCount: number;
  questions: PublishedQuestion[];
}

export default function QuestionBankPage() {
  const router = useRouter();
  const [bankType, setBankType] = useState<"PRELIMS" | "MAINS">("PRELIMS");
  const [questions, setQuestions] = useState<PublishedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const [selectedBloom, setSelectedBloom] = useState("");
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [revealedExplanations, setRevealedExplanations] = useState<Record<string, boolean>>({});

  // Tier info from backend
  const [planTier, setPlanTier] = useState<string>("FREE");
  const [tierLevel, setTierLevel] = useState<number>(0);
  const [canViewAnswers, setCanViewAnswers] = useState<boolean>(false);
  const [maxPerPaper, setMaxPerPaper] = useState<number | string>(5);

  // Active Paper View: null = Exam Cards List; string = viewing specific exam questions
  const [activePaperKey, setActivePaperKey] = useState<string | null>(null);

  useEffect(() => {
    setActivePaperKey(null);
    fetchQuestions();
  }, [bankType, selectedDifficulty, selectedBloom]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
      const params = new URLSearchParams();
      if (selectedDifficulty) params.append("difficulty", selectedDifficulty);
      if (selectedBloom) params.append("bloomLevel", selectedBloom);
      if (search.trim()) params.append("search", search.trim());
      params.append("limit", "100");

      const getCookie = (name: string): string | null => {
        if (typeof document === "undefined") return null;
        const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
        return match ? decodeURIComponent(match[2]) : null;
      };

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("token") || getCookie("token")
          : null;
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const endpoint = bankType === "MAINS" ? "/api/v1/questions/mains" : "/api/v1/questions";
      const res = await fetch(`${baseUrl}${endpoint}?${params.toString()}`, {
        headers,
        credentials: "include",
      });
      const data = await res.json();
      if (data.success && data.data) {
        setQuestions(data.data);
        if (data.meta) {
          if (data.meta.planTier) setPlanTier(data.meta.planTier);
          if (typeof data.meta.tierLevel === "number") setTierLevel(data.meta.tierLevel);
          if (typeof data.meta.canViewAnswers === "boolean") setCanViewAnswers(data.meta.canViewAnswers);
          if (typeof data.meta.canViewModelAnswer === "boolean") setCanViewAnswers(data.meta.canViewModelAnswer);
          if (data.meta.maxPerPaper !== undefined) setMaxPerPaper(data.meta.maxPerPaper);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Group questions by Exam / Paper Title (sourceName + sourceYear)
  const paperGroups: PaperGroup[] = useMemo(() => {
    const map = new Map<string, PaperGroup>();

    for (const q of questions) {
      const title = q.sourceName || q.exam?.name || "Exam Question Paper";
      const year = q.sourceYear || 2026;
      const key = `${title}-${year}`;

      if (!map.has(key)) {
        map.set(key, {
          sourceName: title,
          sourceYear: year,
          examName: q.exam?.name || "General Exam",
          questionCount: 0,
          questions: [],
        });
      }

      const group = map.get(key)!;
      group.questionCount++;
      group.questions.push(q);
    }

    return Array.from(map.values());
  }, [questions]);

  const activeGroup = useMemo(() => {
    if (!activePaperKey) return null;
    return paperGroups.find((g) => `${g.sourceName}-${g.sourceYear}` === activePaperKey) || null;
  }, [activePaperKey, paperGroups]);

  const handleSelectOption = (questionId: string, optionKey: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionKey }));
    setRevealedExplanations((prev) => ({ ...prev, [questionId]: true }));
  };

  const handleToggleExplanation = (questionId: string) => {
    setRevealedExplanations((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  return (
    <div className="min-h-screen min-w-[100vw] bg-[#F4F6FA] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Top Navigation & Dynamic Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={() => {
            if (activePaperKey) {
              setActivePaperKey(null);
            } else {
              router.push("/");
            }
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-xs transition w-fit"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
          <span>{activePaperKey ? "Back to Exam Papers" : "Back to Dashboard"}</span>
        </button>

        {/* Paper Category Toggle: Prelims (Objective) vs Mains (Theory) */}
        <div className="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 p-1">
          <button
            type="button"
            onClick={() => setBankType("PRELIMS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${bankType === "PRELIMS"
                ? "bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-xs"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Prelims (MCQ)
          </button>
          <button
            type="button"
            onClick={() => setBankType("MAINS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${bankType === "MAINS"
                ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Mains (Theory Only)
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 shadow-2xs">
            <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            {planTier === "PREMIUM" ? "Premium Plan (Full Access)" : planTier === "BASIC" ? "Basic Plan (10 Qs / Paper)" : "Free Plan (5 Qs / Paper)"}
          </span>
          <span className="text-xs font-medium text-zinc-500 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1 rounded-full shadow-2xs">
            {activeGroup
              ? `Paper Questions: ${activeGroup.questions.length}`
              : `Total Papers: ${paperGroups.length} (${questions.length} Questions)`}
          </span>
        </div>
      </div>

      {/* Hero Banner (YuktiPrep Brand Identity) */}
      <div className={`text-white rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-sm ${bankType === "MAINS"
          ? "bg-gradient-to-r from-[#1E293B] via-[#334155] to-[#1E3A8A]"
          : "bg-gradient-to-r from-[#19315D] to-[#254A8A]"
        }`}>
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-teal-200 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            {bankType === "MAINS" ? "YuktiPrep Mains Descriptive Theory Bank" : "YuktiPrep Question Intelligence Bank"}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            {activeGroup ? activeGroup.sourceName : bankType === "MAINS" ? "Mains Theory & Descriptive Repository" : "Academic Question Bank"}
          </h1>
          <p className="text-sm text-zinc-200">
            {activeGroup
              ? bankType === "MAINS"
                ? `Official theory and analytical questions for ${activeGroup.sourceName} (${activeGroup.sourceYear}). Free plan shows questions; upgrade to unlock model answers and evaluation rubrics.`
                : planTier === "FREE"
                  ? `Viewing 5 questions from ${activeGroup.sourceName} (${activeGroup.sourceYear}). Upgrade to Basic or Premium to reveal verified answers and derivations.`
                  : `Official question paper for ${activeGroup.sourceName} (${activeGroup.sourceYear}) with answers and academic derivations.`
              : bankType === "MAINS"
                ? "Select an official exam card below to practice descriptive theory questions without multiple-choice options."
                : "Select an official exam card below to view verified questions with sub-statements, derivations, and Bloom cognitive classifications."}
          </p>
        </div>
      </div>

      {/* VIEW 1: EXAM TITLE CARDS GRID (When no exam paper is clicked) */}
      {!activePaperKey && (
        <div className="space-y-4 ">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#1D2B45] dark:text-white">
              Available Exam Papers
            </h2>
            <span className="text-xs text-zinc-500">
              Click an exam title card to view and practice its questions
            </span>
          </div>

          <div className="max-w-[100vw] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {paperGroups.map((paper, idx) => {
              const paperKey = `${paper.sourceName}-${paper.sourceYear}`;
              return (
                <div
                  key={idx}
                  onClick={() => setActivePaperKey(paperKey)}
                  className="group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold">
                        {paper.examName}
                      </span>
                      {paper.sourceYear && (
                        <span className="flex items-center gap-1 text-zinc-500 font-mono text-xs">
                          <Calendar className="w-3.5 h-3.5" />
                          {paper.sourceYear}
                        </span>
                      )}
                    </div>

                    {/* Card Title */}
                    <div>
                      <h3 className="text-base font-bold text-[#1D2B45] dark:text-white group-hover:text-amber-600 transition flex items-center justify-between">
                        <span>{paper.sourceName}</span>
                        <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-amber-600 group-hover:translate-x-1 transition" />
                      </h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        Click card to view questions • {paper.questionCount} Questions Available
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                    <span className="text-zinc-500 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-zinc-400" />
                      Full Exam Paper Set
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePaperKey(paperKey);
                      }}
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold rounded-lg text-xs transition shadow-xs"
                    >
                      Open Questions ({paper.questionCount})
                    </button>
                  </div>
                </div>
              );
            })}

            {paperGroups.length === 0 && !loading && (
              <div className="col-span-2 text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-zinc-400 space-y-2">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="font-semibold text-sm">No exam question papers found.</p>
                <p className="text-xs">Publish draft questions from the Admin Question Intelligence pipeline to view them here.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: QUESTIONS LIST (When an exam card is clicked) */}
      {activeGroup && (
        <div className="space-y-6">
          {/* Filter & Search Bar */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search within this exam paper..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchQuestions()}
                className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-50 dark:bg-zinc-800/60 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              >
                <option value="">All Difficulties</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>

              <select
                value={selectedBloom}
                onChange={(e) => setSelectedBloom(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              >
                <option value="">All Bloom Levels</option>
                <option value="REMEMBER">Remember</option>
                <option value="UNDERSTAND">Understand</option>
                <option value="APPLY">Apply</option>
                <option value="ANALYZE">Analyze</option>
                <option value="EVALUATE">Evaluate</option>
              </select>

              <button
                onClick={() => fetchQuestions()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold text-xs rounded-lg shadow-xs transition"
              >
                Filter
              </button>
            </div>
          </div>

          {/* Render Active Group Questions */}
          <div className="space-y-6">
            {activeGroup.questions.map((q, idx) => {
              const userChoice = selectedAnswers[q.id];
              const isAnswered = Boolean(userChoice);
              const isExplanationOpen = revealedExplanations[q.id];

              return (
                <div
                  key={q.id}
                  className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-xs space-y-4 transition hover:border-zinc-300 dark:hover:border-zinc-700"
                >
                  {/* Question Metadata Pill Tagline */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        Question {idx + 1}
                      </span>
                      {q.sourceName && (
                        <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                          {q.sourceName} {q.sourceYear ? `(${q.sourceYear})` : ""}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {q.bloomLevel && (
                        <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                          {q.bloomLevel}
                        </span>
                      )}
                      {q.difficulty && (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${q.difficulty === "HARD"
                            ? "bg-red-50 dark:bg-red-950/40 text-red-600 border border-red-200 dark:border-red-800"
                            : q.difficulty === "MEDIUM"
                              ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 border border-amber-200 dark:border-amber-800"
                              : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200 dark:border-emerald-800"
                            }`}
                        >
                          {q.difficulty}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Passage if present */}
                  {q.passage && (
                    <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl text-xs italic text-zinc-600 dark:text-zinc-400 border-l-4 border-amber-500">
                      <QuestionMarkdown content={q.passage} />
                    </div>
                  )}

                  {/* Question Text with Sub-statements */}
                  <div className="text-sm md:text-base font-medium leading-relaxed text-zinc-800 dark:text-zinc-100">
                    <QuestionMarkdown content={q.questionText} />
                  </div>

                  {/* Options */}
                  {q.options && q.options.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      {q.options.map((opt) => {
                        const isLocked = q.isAnswerLocked || !canViewAnswers;
                        const isCorrect = !isLocked && opt.key === q.correctAnswer;

                        let styleClass =
                          "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 text-zinc-700 dark:text-zinc-300";

                        if (isCorrect) {
                          styleClass =
                            "border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 font-semibold shadow-2xs";
                        }

                        return (
                          <div
                            key={opt.id || opt.key}
                            className={`p-3 rounded-lg border text-left text-sm flex items-center justify-between transition ${styleClass}`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-xs shrink-0 ${isCorrect
                                    ? "bg-emerald-600 text-white"
                                    : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                                  }`}
                              >
                                {opt.key}
                              </span>
                              <div className="flex-1">
                                <QuestionMarkdown content={opt.text} />
                              </div>
                            </div>
                            {isCorrect && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-600 text-white shrink-0 ml-2 shadow-2xs">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                Correct Answer
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Bottom Actions: Answer Display & Explanation Toggle */}
                  {q.isAnswerLocked || !canViewAnswers ? (
                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/60 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200/50 dark:border-amber-800/40">
                      <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300 font-medium">
                        <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          {bankType === "MAINS"
                            ? "Model answers & evaluation criteria are locked on the Free Plan."
                            : "Answers & explanations are locked on the Free Plan."}
                        </span>
                      </div>
                      <Link
                        href="/plans"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold transition shadow-2xs whitespace-nowrap"
                      >
                        <Crown className="w-3.5 h-3.5" />
                        Unlock with Basic (₹)
                      </Link>
                    </div>
                  ) : (
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {q.correctAnswer && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            Correct Answer: <strong className="font-bold">{q.correctAnswer}</strong>
                          </span>
                        )}
                        {bankType === "MAINS" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            Mains Theory Question
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleToggleExplanation(q.id)}
                        className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 ml-auto"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        {isExplanationOpen
                          ? "Hide Details"
                          : bankType === "MAINS"
                            ? "View Model Answer & Key Points"
                            : "View Explanation & Derivation"}
                      </button>
                    </div>
                  )}

                  {/* Explanation Box / Model Answer */}
                  {!q.isAnswerLocked && canViewAnswers && isExplanationOpen && (
                    <div className="p-4 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs space-y-1">
                      <span className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block text-[10px]">
                        {bankType === "MAINS" ? "Model Answer & Key Theoretical Points" : "Academic Derivation & Basis"}
                      </span>
                      <div className="leading-relaxed text-zinc-700 dark:text-zinc-300">
                        <QuestionMarkdown
                          content={q.modelAnswer || q.explanation || "No model answer provided."}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Bottom Paper Tier Upgrade Notice */}
            {planTier !== "PREMIUM" && (
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-6 text-center space-y-3">
                <Crown className="w-8 h-8 mx-auto text-amber-500" />
                <h4 className="text-base font-bold text-zinc-900 dark:text-white">
                  {planTier === "BASIC"
                    ? "Viewing 10 Questions with Full Answers (Basic Plan)"
                    : "Viewing 5 Sample Questions (Free Plan)"}
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto">
                  {planTier === "BASIC"
                    ? "Upgrade to the Premium Plan to unlock the complete repository of questions for this exam paper and all other papers."
                    : "Upgrade to Basic Plan to reveal verified answers & derivations, or Premium Plan for the entire paper repository."}
                </p>
                <div>
                  <Link
                    href="/plans"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs shadow-md transition"
                  >
                    <Crown className="w-4 h-4" />
                    View Subscription Plans
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
