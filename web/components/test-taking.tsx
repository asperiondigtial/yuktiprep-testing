"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Poppins } from "next/font/google";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  Send,
  Sparkles,
  Info,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTests } from "@/lib/tests-context";
import { api } from "@/lib/api";
import { getMainsPaperById, getMainsQuestions } from "@/lib/mains360-api";
import { OcrMainsPaper, OcrMainsQuestionItem } from "@/types/mains360";
import { AnswerWritingStudio } from "@/components/mains360/AnswerWritingStudio";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

interface Option {
  id: string; // "A", "B", "C", "D"
  text: string;
}

interface Question {
  id: string;
  orderIndex: number;
  question: string;
  options: Option[];
  correctAnswer: string;
  explanation?: string;
}

interface TestData {
  id: string;
  title: string;
  exam: string;
  duration: string;
  difficulty: string;
  questionList: Question[];
}

export function TestTakingScreen() {
  const router = useRouter();
  const params = useParams();
  const { addAttempt } = useTests();

  const testId = useMemo(() => {
    let raw = Array.isArray(params?.testId) ? params.testId[0] : (params?.testId as string);

    // If param is 'default', check the real browser pathname
    if ((!raw || raw === "default") && typeof window !== "undefined") {
      const segments = window.location.pathname.split("/").filter(Boolean);
      // If URL is /tests/<id>, segments might be ["tests", "<id>"]
      const testsIdx = segments.indexOf("tests");
      if (testsIdx !== -1 && segments.length > testsIdx + 1) {
        raw = segments[testsIdx + 1];
      }
    }

    if (raw) {
      // Clean query parameters, extensions, and slashes
      raw = raw.split("?")[0].replace(/\.(txt|html|json)$/i, "").trim();
    }

    // Ignore placeholder, empty, or index file names
    if (!raw || raw === "default" || raw === "index") {
      return "";
    }

    return raw;
  }, [params]);

  const [test, setTest] = useState<TestData | null>(null);
  const [mainsPaper, setMainsPaper] = useState<OcrMainsPaper | null>(null);
  const [mainsQuestions, setMainsQuestions] = useState<OcrMainsQuestionItem[]>([]);
  const [isMainsTest, setIsMainsTest] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({}); // { [qId]: "A" }
  const [showExplanation, setShowExplanation] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

  // Fetch test details & questions (Prelims mock test or Mains 360 paper by id)
  useEffect(() => {
    if (!testId || testId === "default" || testId === "index") {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Try fetching Prelims test
    api.get(`/api/v1/tests/${testId}`)
      .then(async (data) => {
        if (data.success && data.data && data.data.questionList?.length > 0) {
          setTest(data.data);
          setIsMainsTest(false);
        } else {
          // Check if it's a Mains 360 Paper
          await checkAndLoadMainsPaper(testId);
        }
      })
      .catch(async (err: any) => {
        if (err?.code === "QUOTA_EXCEEDED" || err?.status === 403) {
          alert(
            err.message ||
            "You have reached your mock test limit for your plan. Please upgrade to continue."
          );
          router.push("/tests");
          return;
        }
        // Fallback: Check if it's a Mains 360 Paper
        await checkAndLoadMainsPaper(testId);
      })
      .finally(() => {
        setLoading(false);
      });

    async function checkAndLoadMainsPaper(paperId: string) {
      try {
        const [paperData, qData] = await Promise.all([
          getMainsPaperById(paperId),
          getMainsQuestions({ paper_id: paperId, limit: 100 }),
        ]);

        if (paperData || (qData.questions && qData.questions.length > 0)) {
          const effectivePaper: OcrMainsPaper = paperData || {
            id: paperId,
            paper_name: qData.questions[0]?.paper_name || "UPSC Mains Paper",
            time_limit_minutes: 180,
          };
          const sortedQs = [...(qData.questions || [])].sort((a, b) => {
            const numA = parseInt((a.question_number || "").replace(/\D/g, "") || "9999", 10);
            const numB = parseInt((b.question_number || "").replace(/\D/g, "") || "9999", 10);
            if (numA !== numB) return numA - numB;
            return (a.question_number || "").localeCompare(b.question_number || "", undefined, { numeric: true });
          });
          setMainsPaper(effectivePaper);
          setMainsQuestions(sortedQs);
          setIsMainsTest(true);
        } else {
          setTest(null);
          setIsMainsTest(false);
        }
      } catch (e) {
        console.warn("Not a mains paper either:", e);
        setTest(null);
        setIsMainsTest(false);
      }
    }
  }, [testId, router]);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    // Select answer and automatically reveal green/red feedback
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
    setShowExplanation((prev) => ({
      ...prev,
      [questionId]: true,
    }));
  };

  const currentQuestion = test?.questionList?.[currentIdx];
  const totalQuestions = test?.questionList?.length || 0;

  const handleSubmitTest = async () => {
    if (isSubmitting) return;

    const unansweredCount = (test?.questionList || []).filter((q) => !userAnswers[q.id]).length;
    if (unansweredCount > 0) {
      const confirmSubmit = confirm(
        `You have ${unansweredCount} unanswered question(s). Do you still want to finish and view results?`
      );
      if (!confirmSubmit) return;
    }

    setIsSubmitting(true);
    try {
      const data = await api.post(`/api/v1/tests/${testId}/submit`, {
        userAnswers,
        timeTakenSec: secondsElapsed,
      });

      if (data.success && data.data?.attemptId) {
        addAttempt({
          title: test?.title || "Mock Test",
          exam: test?.exam || "Competitive Exam",
          score: data.data.score,
          correct: data.data.correct,
          status: "Submitted",
          badge: "AI",
          date: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "numeric",
          }),
        });

        router.push(`/tests/result/${data.data.attemptId}`);
      } else {
        router.push(`/tests/result/${testId}`);
      }
    } catch (err) {
      console.error("Failed to submit test", err);
      router.push(`/tests/result/${testId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className={`${poppins.variable} flex flex-1 flex-col items-center justify-center min-h-[600px] font-poppins`}>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#0F7F8C] border-t-transparent" />
        <p className="mt-4 text-sm font-medium text-[#647084]">Loading Question Paper...</p>
      </main>
    );
  }

  // If this test is a Mains 360 Question Paper, render AnswerWritingStudio
  if (isMainsTest && mainsPaper) {
    return (
      <main className={`${poppins.variable} flex flex-1 flex-col min-w-0 h-full overflow-y-auto rounded-tl-2xl border border-neutral-200 bg-[#F4F6FA] p-3 md:p-5 font-poppins thin-scrollbar`}>
        <div className="mx-auto w-full max-w-7xl flex flex-1 flex-col min-h-0 pb-12">
          <AnswerWritingStudio
            paper={mainsPaper}
            questions={mainsQuestions}
            onBackToPapers={() => router.push("/tests?tab=mains360")}
            onFinishToAnalytics={() => router.push("/tests?tab=mains360&subtab=analytics")}
          />
        </div>
      </main>
    );
  }

  if (!test || !currentQuestion) {
    return (
      <main className={`${poppins.variable} flex flex-1 flex-col items-center justify-center p-8 font-poppins`}>
        <h2 className="text-xl font-bold text-[#1F314D]">Test Not Found</h2>
        <Button onClick={() => router.push("/tests")} className="mt-4 bg-[#0F7F8C]">
          Back to Tests
        </Button>
      </main>
    );
  }

  const selectedAnswer = userAnswers[currentQuestion.id];
  const isAnswered = Boolean(selectedAnswer);
  const isSelectedCorrect = selectedAnswer?.toUpperCase() === currentQuestion.correctAnswer.toUpperCase();

  return (
    <main
      className={`${poppins.variable} flex flex-1 flex-col min-w-0 h-full overflow-y-auto rounded-tl-2xl border border-neutral-200 bg-[#F4F6FA] p-4 md:p-8 font-poppins`}
    >
      <div className="mx-auto w-full max-w-[960px] flex flex-col gap-5">
        {/* Top Header & Navigation */}
        <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-[#E2E6EE] shadow-xs">
          <button
            type="button"
            onClick={() => {
              if (confirm("Are you sure you want to leave this test? Your progress will be lost.")) {
                router.push("/tests");
              }
            }}
            className="flex items-center gap-2 text-sm font-medium text-[#1F314D] hover:text-[#0F7F8C] transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-semibold">Exit Test</span>
          </button>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#DDF3F5] text-[#0F7F8C] font-semibold text-xs">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatTimer(secondsElapsed)}</span>
            </div>

            <Button
              onClick={handleSubmitTest}
              disabled={isSubmitting}
              className="bg-[#0F7F8C] hover:bg-[#0c6670] text-white text-xs px-4 h-9 rounded-xl font-semibold shadow-xs flex items-center gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isSubmitting ? "Submitting..." : "Submit Test"}</span>
            </Button>
          </div>
        </div>

        {/* Test Title & Difficulty Banner */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2E6EE] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-[#1F314D]">{test.title}</h1>
            <p className="text-xs text-[#647084] mt-0.5 font-medium">{test.exam}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              {test.difficulty}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Q {currentIdx + 1} of {totalQuestions}
            </span>
          </div>
        </div>

        {/* Question Palette / Bubble Bar */}
        <div className="bg-white rounded-2xl p-3 border border-[#E2E6EE] shadow-xs flex items-center gap-2 overflow-x-auto">
          {test.questionList.map((q, idx) => {
            const isCurr = idx === currentIdx;
            const ans = userAnswers[q.id];
            const isCorrect = ans && ans.toUpperCase() === q.correctAnswer.toUpperCase();
            const isWrong = ans && !isCorrect;

            let badgeClass = "bg-gray-100 text-gray-700 hover:bg-gray-200";
            if (isCurr) {
              badgeClass = "ring-2 ring-[#0F7F8C] bg-[#DDF3F5] text-[#0F7F8C] font-bold";
            } else if (isCorrect) {
              badgeClass = "bg-[#10B981] text-white font-semibold";
            } else if (isWrong) {
              badgeClass = "bg-[#EF4444] text-white font-semibold";
            }

            return (
              <button
                key={q.id}
                onClick={() => setCurrentIdx(idx)}
                className={`h-8 w-8 shrink-0 rounded-lg text-xs font-semibold transition flex items-center justify-center ${badgeClass}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Current Question Card */}
        <div className="bg-white rounded-2xl p-6 md:p-8 border border-[#E2E6EE] shadow-xs flex flex-col gap-6">
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F7F8C] bg-[#DDF3F5] px-2.5 py-1 rounded-md">
              Question {currentIdx + 1}
            </span>
            {isAnswered && (
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                {isSelectedCorrect ? (
                  <span className="text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Correct
                  </span>
                ) : (
                  <span className="text-red-600 flex items-center gap-1 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                    <XCircle className="h-3.5 w-3.5" /> Incorrect
                  </span>
                )}
              </div>
            )}
          </div>

          <h2 className="text-base md:text-lg font-semibold text-[#1F314D] leading-relaxed whitespace-pre-line">
            {currentQuestion.question}
          </h2>

          {/* MCQ Options with Green (Correct) & Red (Wrong) Highlighting */}
          <div className="flex flex-col gap-3">
            {currentQuestion.options.map((opt) => {
              const isSelected = selectedAnswer === opt.id;
              const isCorrectOption = opt.id.toUpperCase() === currentQuestion.correctAnswer.toUpperCase();

              let cardStyle = "border-[#E2E6EE] bg-white hover:border-[#0F7F8C] hover:bg-slate-50/50 text-[#1F314D]";
              let letterStyle = "bg-gray-100 text-gray-700 border-gray-200";

              if (isAnswered) {
                if (isCorrectOption) {
                  // CORRECT ANSWER: ALWAYS HIGHLIGHT GREEN
                  cardStyle = "border-[#10B981] bg-[#E4F6EE] text-[#065F46] font-medium shadow-xs";
                  letterStyle = "bg-[#10B981] text-white border-[#10B981]";
                } else if (isSelected && !isCorrectOption) {
                  // SELECTED WRONG ANSWER: HIGHLIGHT RED
                  cardStyle = "border-[#EF4444] bg-[#FDEBEC] text-[#991B1B] font-medium shadow-xs";
                  letterStyle = "bg-[#EF4444] text-white border-[#EF4444]";
                } else {
                  cardStyle = "border-gray-200 bg-gray-50/50 text-gray-400 opacity-70";
                  letterStyle = "bg-gray-100 text-gray-400 border-gray-200";
                }
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectOption(currentQuestion.id, opt.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between gap-3 ${cardStyle}`}
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs border ${letterStyle} shrink-0`}
                    >
                      {opt.id}
                    </span>
                    <span className="text-sm md:text-base leading-snug">{opt.text}</span>
                  </div>

                  {isAnswered && isCorrectOption && (
                    <CheckCircle2 className="h-5 w-5 text-[#10B981] shrink-0" />
                  )}
                  {isAnswered && isSelected && !isCorrectOption && (
                    <XCircle className="h-5 w-5 text-[#EF4444] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Instant Explanation Box */}
          {isAnswered && (
            <div className="rounded-xl border border-dashed border-[#0F7F8C]/40 bg-[#DDF3F5]/40 p-4 transition-all animate-in fade-in">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0F7F8C] uppercase tracking-wide mb-1">
                <Info className="h-4 w-4" />
                <span>Explanation</span>
              </div>
              <p className="text-xs md:text-sm text-[#1F314D] leading-relaxed">
                {currentQuestion.explanation ||
                  `The correct answer is Option ${currentQuestion.correctAnswer}.`}
              </p>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E2E6EE]">
            <Button
              variant="outline"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
              className="text-xs font-semibold flex items-center gap-1.5 h-10 px-4 rounded-xl border-gray-200 text-[#1F314D]"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            {currentIdx < totalQuestions - 1 ? (
              <Button
                onClick={() => setCurrentIdx((prev) => Math.min(totalQuestions - 1, prev + 1))}
                className="text-xs font-semibold flex items-center gap-1.5 h-10 px-5 rounded-xl bg-[#233249] hover:bg-[#1b273a] text-white"
              >
                Next Question
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmitTest}
                disabled={isSubmitting}
                className="text-xs font-semibold flex items-center gap-1.5 h-10 px-5 rounded-xl bg-[#0F7F8C] hover:bg-[#0c6670] text-white shadow-xs"
              >
                <Award className="h-4 w-4" />
                Finish & View Results
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default TestTakingScreen;
