"use client";

import React, { useState, useEffect } from "react";
import {
  PenTool,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Camera,
  CheckCircle2,
  FileText,
  Clock,
  UserCheck,
  BarChart3,
  Target,
  Zap,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Send,
  Layers,
  ArrowLeft,
  Image as ImageIcon,
  ZoomIn,
  X,
  ChevronDown,
  ChevronUp,
  Languages,
  Award,
  BookOpen,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { OcrMainsPaper, OcrMainsQuestionItem, EvaluationResult } from "@/types/mains360";
import {
  evaluateMainsAnswerApi,
  brainstormMainsTopicApi,
  saveMainsAttemptApi,
} from "@/lib/mains360-api";
import { OCRScannerModal } from "./OCRScannerModal";
import { RevisionWorkspaceModal } from "./RevisionWorkspaceModal";

interface AnswerWritingStudioProps {
  paper: OcrMainsPaper;
  questions: OcrMainsQuestionItem[];
  onBackToPapers: () => void;
  onFinishToAnalytics?: () => void;
}

export function AnswerWritingStudio({
  paper,
  questions: rawQuestions,
  onBackToPapers,
  onFinishToAnalytics,
}: AnswerWritingStudioProps) {
  // Sort questions predictably by question_number so they never shuffle
  const questions = React.useMemo(() => {
    return [...(rawQuestions || [])].sort((a, b) => {
      const getNum = (q: OcrMainsQuestionItem) => {
        const str = q.question_number || "";
        const match = str.match(/\d+/);
        return match ? parseInt(match[0], 10) : 9999;
      };
      const numA = getNum(a);
      const numB = getNum(b);
      if (numA !== numB) return numA - numB;
      return (a.question_number || "").localeCompare(b.question_number || "", undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
  }, [rawQuestions]);

  const [activeQIndex, setActiveQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});

  // Active question
  const currentQ = questions[activeQIndex] || questions[0] || {
    id: "default-q1",
    text_en: "No question text provided.",
    marks: "10",
    section: "A",
  };

  // Timer: 180 mins default, auto-starts on loading the test
  const totalDurationMinutes = paper.time_limit_minutes || 180;
  const [secondsRemaining, setSecondsRemaining] = useState(totalDurationMinutes * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  // Modals
  const [isOCRModalOpen, setIsOCRModalOpen] = useState(false);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Language & collapsible state
  const [showHindi, setShowHindi] = useState(false);
  const [isSubquestionsExpanded, setIsSubquestionsExpanded] = useState(true);
  const [isReviewSubquestionsExpanded, setIsReviewSubquestionsExpanded] = useState(true);

  // Post-test state & overall batch evaluation
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isAnalyzingTest, setIsAnalyzingTest] = useState(false);
  const [evaluationsByQuestion, setEvaluationsByQuestion] = useState<Record<string, EvaluationResult>>({});
  const [brainstormsByQuestion, setBrainstormsByQuestion] = useState<Record<string, any>>({});
  const [activeReviewQIndex, setActiveReviewQIndex] = useState(0);
  const [activeEvalTab, setActiveEvalTab] = useState<
    "risk_audit" | "where_missed" | "how_to_fix" | "pillars_radar" | "sme_feedback"
  >("risk_audit");

  // Timer interval
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && secondsRemaining > 0 && !isSubmitted) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            // Auto submit when time runs out
            setTimeout(() => handleSubmitFullPaper(), 100);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, secondsRemaining, isSubmitted]);

  const formatTimer = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleAnswerChange = (val: string) => {
    setAnswers((prev) => ({ ...prev, [currentQ.id]: val }));
  };

  const currentText = answers[currentQ.id] || "";
  const wordCount = currentText.trim().split(/\s+/).filter(Boolean).length;
  const targetWords = parseInt(currentQ.marks || "10") === 15 ? 250 : 150;

  const attemptedCount = Object.keys(answers).filter(
    (k) => (answers[k] || "").trim().length > 0
  ).length;

  // Submit complete test and automatically analyze all attempted questions with AI
  const handleSubmitFullPaper = async () => {
    if (isSubmitted || isAnalyzingTest) return;

    const unansweredCount = questions.length - attemptedCount;
    if (unansweredCount > 0 && secondsRemaining > 0) {
      const confirmSubmit = confirm(
        `You have ${unansweredCount} unattempted question(s). Do you want to submit the paper and view your AI 360° Evaluation & Brainstorm report?`
      );
      if (!confirmSubmit) return;
    }

    setIsTimerRunning(false);
    setIsSubmitted(true);
    setIsAnalyzingTest(true);

    const newEvals: Record<string, EvaluationResult> = {};
    const newBrainstorms: Record<string, any> = {};

    try {
      // Analyze attempted questions with AI
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const ans = answers[q.id]?.trim();

        if (ans && ans.length > 0) {
          try {
            // Build rich topic text combining main prompt and subquestions
            const subquestionsCombined = (q.subquestions || [])
              .map((sq, sIdx) => {
                const num = sq.subquestion_number || sq.label || `(${sIdx + 1})`;
                const st = sq.text_en || sq.text || "";
                return st ? `${num} ${st}` : "";
              })
              .filter(Boolean)
              .join("\n");

            const topicParts = [
              q.question_number ? `Question ${q.question_number}` : "",
              q.subheading || "",
              q.text_en || "",
              subquestionsCombined,
            ].filter(Boolean);

            const effectiveTopic = topicParts.join("\n\n").trim() || `Question ${q.question_number || i + 1}`;

            const [evalRes, brainstormRes] = await Promise.allSettled([
              evaluateMainsAnswerApi({
                topic: effectiveTopic,
                text: ans,
                plan: null,
                upsc_section: q.section || "GS",
                target_words: parseInt(q.marks || "10") === 15 ? 250 : 150,
                question_number: q.question_number,
                subquestions: q.subquestions,
              }),
              brainstormMainsTopicApi({
                topic: effectiveTopic,
                upsc_section: q.section || "GS",
                target_words: parseInt(q.marks || "10") === 15 ? 250 : 150,
                question_number: q.question_number,
                subquestions: q.subquestions,
              }),
            ]);

            if (evalRes.status === "fulfilled" && evalRes.value) {
              const res = evalRes.value;
              const maxQMarks = parseInt(q.marks || "10");
              const parsedAwarded = parseFloat(res.score_estimate_range?.split("-")[0] || "6.5");
              const awardedRatio = Math.min(1, Math.max(0.3, parsedAwarded / (maxQMarks || 10)));

              // Dynamically determine pillars based on backend AI response or answer attributes
              const detectedThinkersCount = (res.evidence_and_thinker_grounding?.detected_thinkers || []).length;
              const activeLensesCount = (res.dimensional_matrix_audit?.active_lenses || []).length;
              const missingLensesCount = (res.dimensional_matrix_audit?.missing_lenses || []).length;
              const hasDialectic = Boolean(res.dialectic_synthesis_analysis?.has_counter_argument);
              const answerWords = ans.split(/\s+/).filter(Boolean).length;
              const targetW = maxQMarks === 15 ? 250 : 150;
              const wordRatio = Math.min(1.1, answerWords / (targetW || 150));

              // Dynamic 6 pillars computation (0 - 100)
              const dynamicPillars = res.pillars_360 || {
                directive_precision: Math.min(96, Math.max(45, Math.round(awardedRatio * 92 + (wordRatio >= 0.8 && wordRatio <= 1.15 ? 6 : -4)))),
                substantive_authority: Math.min(95, Math.max(40, Math.round(50 + detectedThinkersCount * 14 + (res.overall_band?.includes("Distinguished") ? 15 : 5)))),
                multidimensional_pestle: Math.min(95, Math.max(42, Math.round(48 + activeLensesCount * 12 - missingLensesCount * 4))),
                examiner_impression_index: Math.min(98, Math.max(45, Math.round(awardedRatio * 88 + (ans.includes("\n") || ans.includes("1.") || ans.includes("•") ? 8 : 2)))),
                visual_scannability: Math.min(94, Math.max(40, Math.round(52 + (ans.includes(":") ? 12 : 4) + (ans.split("\n\n").length > 2 ? 14 : 4)))),
                visionary_synthesis: Math.min(95, Math.max(40, Math.round(50 + (hasDialectic ? 22 : 6) + (awardedRatio > 0.7 ? 12 : 4)))),
              };

              // Dynamic overall 360 index (weighted composite or from response)
              const dynamicOverall360 = typeof res.overall_360_index === "number" && res.overall_360_index > 0
                ? Math.round(res.overall_360_index)
                : Math.round(
                    (dynamicPillars.directive_precision * 0.22) +
                    (dynamicPillars.substantive_authority * 0.20) +
                    (dynamicPillars.multidimensional_pestle * 0.18) +
                    (dynamicPillars.examiner_impression_index * 0.16) +
                    (dynamicPillars.visual_scannability * 0.12) +
                    (dynamicPillars.visionary_synthesis * 0.12)
                  );

              newEvals[q.id] = {
                question_number: q.question_number || String(i + 1),
                question_text: q.subheading || q.text_en || "",
                overall_band: res.overall_band || (dynamicOverall360 >= 85 ? "Distinguished (Top 5%)" : dynamicOverall360 >= 75 ? "Strong Analytical" : "Developing Foundation"),
                score_estimate_range: res.score_estimate_range || `${parsedAwarded}-${Math.min(maxQMarks, parsedAwarded + 1.5)}`,
                awarded_marks: parsedAwarded,
                max_marks: maxQMarks,
                overall_360_index: dynamicOverall360,
                percentile_band: res.percentile_band || (dynamicOverall360 >= 85 ? "Top 5%" : dynamicOverall360 >= 75 ? "Top 15%" : "Top 35%"),
                executive_summary: res.executive_summary || "Good structural alignment.",
                sectional_scores: {
                  introduction: res.hook_and_thesis_analysis?.critique || "Crisp hook.",
                  body_structure: res.executive_summary || "Multidimensional arguments.",
                  substantiation:
                    res.evidence_and_thinker_grounding?.detected_thinkers?.join(", ") ||
                    "Constitutional provisions cited.",
                  conclusion: "Balanced and forward looking.",
                },
                risk_analysis: {
                  risk_level: dynamicOverall360 >= 80 ? "Low Risk" : dynamicOverall360 >= 65 ? "Moderate Risk" : "Elevated Risk",
                  badge_color: dynamicOverall360 >= 80 ? "emerald" : dynamicOverall360 >= 65 ? "amber" : "rose",
                  failure_probability_pct: Math.max(5, Math.min(65, 100 - dynamicOverall360)),
                  vulnerabilities: (res.paragraph_breakdown || []).map((p: any) => ({
                    type: p.role,
                    impact: "Variable",
                    description: p.critique,
                    how_examiner_views_it: "Examiner feedback",
                  })),
                },
                root_cause_analysis: {
                  primary_failure_mode: res.dialectic_synthesis_analysis?.critique || "Limited counter-perspectives.",
                  missed_authoritative_anchors: (res.evidence_and_thinker_grounding?.suggested_enrichments || []).map(
                    (e: any) => `${e.thinker} (${e.quote_or_concept})`
                  ),
                  missed_key_dimensions: res.dimensional_matrix_audit?.missing_lenses || ["Panchayati Raj", "Technological"],
                  cognitive_blindspots: [res.dimensional_matrix_audit?.advice || "Missing institutional lenses"],
                },
                remedial_blueprint: {
                  phase_1_immediate_fix: "Clarify core directive in first sentence.",
                  phase_2_body_overhaul: "Add headings for multi-dimensional aspects.",
                  phase_3_evidence_injection: "Add committee reports or precedents.",
                  phase_4_conclusion_upgrade: "Link conclusion to broader vision & Constitutional Morality.",
                  sentence_transformation_demo: {
                    before_candidate_draft: ans.slice(0, 80) + "...",
                    after_topper_rewrite:
                      "By contextualizing the doctrine within constitutional morality and Article 21 jurisprudence, institutional balance is restored.",
                    why_it_scores_more: "Higher substantive precision.",
                  },
                  topper_gold_booster_lines: res.examiner_recommendations || [
                    "Constitutional Morality acts as the bulwark against majoritarian arbitrariness.",
                  ],
                },
                value_add_diagram: {
                  title: "Suggested Institutional Framework",
                  benefit: "+1 Mark Advantage",
                  suggested_diagram: "[Input / Policy] --> [Checks & Balances] --> [Equitable Delivery]",
                },
                pillars_360: dynamicPillars,
                sme_feedback: {
                  board_lead_examiner: {
                    title: "Board Lead Examiner",
                    verdict: "Strong analytical clarity.",
                    examiner_psychology_tip: res.executive_summary || "Answer satisfies core requirements.",
                  },
                  domain_specialist: {
                    title: "Subject Specialist",
                    technical_critique: "Sound domain foundation with accurate terminology.",
                    recommended_precedents: ["2nd ARC", "Key Precedents"],
                  },
                  revision_mentor: {
                    title: "Senior Revision Mentor",
                    score_leap_strategy: "Inject data and flowcharts to breach the 8+ mark threshold.",
                    practical_drill: "Practice writing 5-point intro hooks within 60 seconds.",
                  },
                },
              };
            }

            if (brainstormRes.status === "fulfilled" && brainstormRes.value) {
              newBrainstorms[q.id] = brainstormRes.value;
            }
          } catch (itemErr) {
            console.warn("Item AI evaluation error:", itemErr);
          }
        }
      }

      setEvaluationsByQuestion(newEvals);
      setBrainstormsByQuestion(newBrainstorms);

      // Save complete attempt to database
      const totalScore = Object.values(newEvals).reduce((acc, curr) => acc + (typeof curr.awarded_marks === "number" ? curr.awarded_marks : 0), 0);
      const totalMaxScore = questions.reduce((acc, q) => acc + parseInt(q.marks || "10"), 0);

      await saveMainsAttemptApi({
        paperId: paper.id,
        paperTitle: paper.paper_name,
        paperCode: paper.subject_type || "GS-Paper",
        totalQuestions: questions.length,
        attemptedCount,
        totalMarks: Number(totalScore.toFixed(1)),
        totalMaxMarks: paper.total_marks || totalMaxScore,
        scorePct: Math.round((totalScore / (totalMaxScore || 1)) * 100),
        timeElapsedMins: Math.round(((paper.time_limit_minutes || 180) * 60 - secondsRemaining) / 60),
        answersJson: answers,
        evaluationReport: {
          evaluations: newEvals,
          brainstorms: newBrainstorms,
        },
      });
    } catch (err) {
      console.error("Failed to complete full paper evaluation:", err);
    } finally {
      setIsAnalyzingTest(false);
    }
  };

  // -------------------------------------------------------------
  // POST-TEST RESULT & AI EVALUATION DASHBOARD VIEW
  // -------------------------------------------------------------
  if (isSubmitted) {
    if (isAnalyzingTest) {
      return (
        <div className="flex min-h-[95vh] flex-col items-center justify-center gap-4 rounded-3xl border border-[#E2E6EE] bg-white p-8 text-center shadow-xs">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DDF3F5] text-[#0F7F8C]">
            <RefreshCw className="h-7 w-7 animate-spin" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#1F314D]">
              Generating 360° AI Board Evaluation & Diagnostic Report...
            </h3>
            <p className="mt-1 text-xs md:text-sm text-[#647084] max-w-lg mx-auto">
              Evaluating your answers against official UPSC CSE rubrics (Directive precision, PESTLE multi-dimensionality, authoritative citations, and brainstorm dialectics).
            </p>
          </div>
        </div>
      );
    }

    const reviewQ = questions[activeReviewQIndex] || questions[0];
    const reviewEval = evaluationsByQuestion[reviewQ.id];
    const reviewBrainstorm = brainstormsByQuestion[reviewQ.id];
    const reviewAnswer = answers[reviewQ.id] || "";

    const totalAwarded = Object.values(evaluationsByQuestion).reduce((acc, curr) => acc + (curr.awarded_marks || 0), 0);
    const totalMax = questions.reduce((acc, q) => acc + parseInt(q.marks || "10"), 0);
    const avgScorePct = Math.round((totalAwarded / (totalMax || 1)) * 100);

    return (
      <div className="flex flex-col h-full min-h-0 gap-4">
        {/* Post-Test Header Bar (Fixed) */}
        <div className="shrink-0 rounded-3xl border border-[#E2E6EE] bg-white p-4 md:p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E6EE] pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  Test Completed & Evaluated
                </span>
                <h2 className="text-lg md:text-xl font-bold text-[#1F314D] mt-0.5">
                  {paper.paper_name} — AI Diagnostic Report
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={onBackToPapers}
                className="rounded-2xl border-[#E2E6EE] text-xs font-semibold h-9 px-3.5 hover:bg-neutral-50"
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back to Papers
              </Button>
              <Button
                type="button"
                onClick={onFinishToAnalytics || onBackToPapers}
                className="rounded-2xl bg-[#0F7F8C] hover:bg-[#0c6b76] text-white text-xs font-bold h-9 px-4 shadow-xs"
              >
                <BarChart3 className="mr-1.5 h-4 w-4" />
                Finish & View Analytics
              </Button>
            </div>
          </div>

          {/* Performance Overview Badges */}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
            <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E6EE] p-2.5">
              <span className="text-[10px] text-[#647084] font-medium uppercase tracking-wider">Total Score</span>
              <div className="text-base md:text-lg font-bold text-[#1F314D] mt-0.5">
                {totalAwarded.toFixed(1)} / {totalMax} M
              </div>
            </div>
            <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E6EE] p-2.5">
              <span className="text-[10px] text-[#647084] font-medium uppercase tracking-wider">Attempted</span>
              <div className="text-base md:text-lg font-bold text-[#1F314D] mt-0.5">
                {attemptedCount} / {questions.length} Qs
              </div>
            </div>
            <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E6EE] p-2.5">
              <span className="text-[10px] text-[#647084] font-medium uppercase tracking-wider">Score Percentage</span>
              <div className="text-base md:text-lg font-bold text-emerald-600 mt-0.5">
                {avgScorePct}%
              </div>
            </div>
            <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E6EE] p-2.5">
              <span className="text-[10px] text-[#647084] font-medium uppercase tracking-wider">Time Taken</span>
              <div className="text-base md:text-lg font-bold text-[#1F314D] mt-0.5">
                {Math.round(((paper.time_limit_minutes || 180) * 60 - secondsRemaining) / 60)} mins
              </div>
            </div>
          </div>
        </div>

        {/* Question Review Selector Bar (Fixed) */}
        <div className="shrink-0 rounded-3xl border border-[#E2E6EE] bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-xs font-bold text-[#1F314D]">Select Question to Inspect Diagnostic:</span>
            <span className="text-xs text-[#647084]">Question {activeReviewQIndex + 1} of {questions.length}</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto py-1 px-1 thin-scrollbar">
            {questions.map((q, idx) => {
              const hasAns = (answers[q.id] || "").trim().length > 0;
              const hasEv = !!evaluationsByQuestion[q.id];
              const isCurr = activeReviewQIndex === idx;

              let btnCls = "bg-[#F8FAFC] border-[#E2E6EE] text-[#1F314D] hover:bg-neutral-100";
              if (hasEv) btnCls = "bg-emerald-50 border-emerald-300 text-emerald-800 font-bold";
              else if (hasAns) btnCls = "bg-amber-50 border-amber-300 text-amber-800 font-bold";
              if (isCurr) btnCls += " !border-[#0F7F8C] !bg-[#0F7F8C]/10 !text-[#0F7F8C] font-bold border-2 shadow-xs";

              return (
                <button
                  key={q.id || idx}
                  type="button"
                  onClick={() => setActiveReviewQIndex(idx)}
                  className={`flex h-8 px-3 shrink-0 items-center justify-center rounded-xl border text-xs font-semibold transition ${btnCls}`}
                >
                  Q{idx + 1}
                  {hasEv && (
                    <span className="ml-1 text-[10px] text-emerald-700">
                      ({evaluationsByQuestion[q.id].awarded_marks}M)
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Review Workspace: 2-Column Split (Responsive: Stack on Mobile/Tablet, 2-Col 90vh on Desktop) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 items-stretch">
          {/* Left Column: Question & Candidate Answer */}
          <div className="rounded-3xl border border-[#E2E6EE] bg-white shadow-xs flex flex-col h-[70vh] sm:h-[75vh] lg:h-[90vh] min-h-[420px] overflow-hidden">
            {/* Left Header */}
            <div className="shrink-0 p-3.5 sm:p-4 border-b border-[#E2E6EE] flex items-center justify-between gap-2 bg-[#F8FAFC]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-full bg-[#1F314D] px-3 py-1 text-xs font-bold text-white">
                  Question {reviewQ.question_number || activeReviewQIndex + 1}
                </span>
                {reviewQ.section && (
                  <span className="rounded-full bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                    {reviewQ.section}
                  </span>
                )}
                <span className="rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                  {reviewQ.marks || "10"} Marks
                </span>
                {reviewQ.subquestions && reviewQ.subquestions.length > 0 && (
                  <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                    {reviewQ.subquestions.length} Subquestions
                  </span>
                )}
              </div>
              <span className="text-xs text-[#647084] shrink-0">
                Attempted: {reviewAnswer.trim().split(/\s+/).filter(Boolean).length} words
              </span>
            </div>

            {/* Left Content Scrollable Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 thin-scrollbar">
              {/* Primary Question Text */}
              {reviewQ.text_en ? (
                <p className="text-sm md:text-base font-semibold text-[#1F314D] leading-relaxed">
                  {reviewQ.text_en}
                </p>
              ) : reviewQ.subquestions && reviewQ.subquestions.length > 0 ? (
                <p className="text-sm font-medium text-[#647084] italic">
                  Subquestions & Locational Points for Question {reviewQ.question_number || activeReviewQIndex + 1}:
                </p>
              ) : null}

              {/* Diagrams / Maps */}
              {reviewQ.diagrams && reviewQ.diagrams.length > 0 && (
                <div className="space-y-2 border-t border-[#E2E6EE] pt-3">
                  <span className="text-xs font-bold text-[#1F314D]">Question Diagrams & Maps:</span>
                  <div className="grid grid-cols-1 gap-2">
                    {reviewQ.diagrams.map((d, i) => (
                      <div
                        key={i}
                        className="rounded-2xl border border-[#E2E6EE] bg-neutral-50 p-2 overflow-hidden"
                      >
                        <img
                          src={d.data_url || d.url || d.image_url}
                          alt={d.title || "Diagram"}
                          className="w-full max-h-56 object-contain rounded-xl bg-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Subquestions & Points in Review Mode */}
              {reviewQ.subquestions && reviewQ.subquestions.length > 0 && (
                <div className="border-t border-[#E2E6EE] pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      type="button"
                      onClick={() => setIsReviewSubquestionsExpanded(!isReviewSubquestionsExpanded)}
                      className="flex items-center gap-1.5 text-xs font-bold text-[#1F314D] hover:text-[#0F7F8C] transition"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#0F7F8C]/10 text-[#0F7F8C]">
                        {isReviewSubquestionsExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <span>
                        Subquestions ({reviewQ.subquestions.length} items)
                      </span>
                    </button>
                    <span className="text-[11px] text-[#647084]">
                      {isReviewSubquestionsExpanded ? "Collapse" : "Expand"}
                    </span>
                  </div>

                  {isReviewSubquestionsExpanded && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1 pb-2">
                      {reviewQ.subquestions.map((sub, sIdx) => {
                        const subNum = sub.subquestion_number || sub.label || `(${sIdx + 1})`;
                        const subTextEn = sub.text_en || sub.text || "";
                        const subTextHi = sub.text_hi || "";

                        return (
                          <div
                            key={sIdx}
                            className="rounded-xl border border-[#E2E6EE] bg-[#F8FAFC] p-2.5 flex flex-col justify-between gap-1 shadow-2xs"
                          >
                            <div className="flex items-start gap-2">
                              <span className="shrink-0 rounded-md bg-[#1F314D]/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#1F314D]">
                                {subNum}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-[#1F314D] leading-snug">
                                  {subTextEn}
                                </p>
                                {subTextHi && (
                                  <p className="text-[11px] text-[#647084] font-normal leading-snug mt-0.5">
                                    {subTextHi}
                                  </p>
                                )}
                              </div>
                            </div>
                            {sub.marks && (
                              <div className="text-right">
                                <span className="inline-block rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                  {sub.marks} marks
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Candidate Submitted Answer Card */}
              <div className="rounded-2xl border border-[#E2E6EE] bg-[#FAFAFA] p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-[#E2E6EE] pb-2">
                  <span className="text-xs font-bold text-[#1F314D] flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-[#0F7F8C]" />
                    Your Submitted QCAB Answer
                  </span>
                </div>

                {reviewAnswer.trim() ? (
                  <div className="text-xs md:text-sm text-[#1F314D] leading-relaxed whitespace-pre-wrap font-mono">
                    {reviewAnswer}
                  </div>
                ) : (
                  <div className="text-center text-xs text-[#647084] py-3">
                    Question was left unattempted in this paper attempt.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: AI 360° Diagnostic & Brainstorm Suite */}
          <div className="rounded-3xl border border-[#E2E6EE] bg-white shadow-xs flex flex-col h-[70vh] sm:h-[75vh] lg:h-[90vh] min-h-[420px] overflow-hidden">
            {reviewEval ? (
              <>
                {/* Header score (Fixed) */}
                <div className="shrink-0 p-4 border-b border-[#E2E6EE] flex items-center justify-between bg-white">
                  <div>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-bold">
                      {reviewEval.overall_band}
                    </span>
                    <h3 className="text-xl md:text-2xl font-black text-[#1F314D] mt-0.5">
                      {reviewEval.awarded_marks} / {reviewEval.max_marks} Marks
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      Quality: {reviewEval.overall_360_index}/100
                    </span>
                    <div className="text-xs text-[#647084] mt-0.5">
                      {reviewEval.percentile_band}
                    </div>
                  </div>
                </div>

                {/* Tab buttons (Fixed) */}
                <div className="shrink-0 px-4 py-2.5 flex gap-2 overflow-x-auto border-b border-[#E2E6EE] bg-[#F8FAFC] thin-scrollbar">
                  {[
                    { id: "risk_audit", label: "Risk Audit", icon: AlertTriangle },
                    { id: "where_missed", label: "Where Missed", icon: Target },
                    { id: "how_to_fix", label: "How To Fix", icon: Zap },
                    { id: "pillars_radar", label: "360° Pillars", icon: BarChart3 },
                    { id: "sme_feedback", label: "SME Guidance", icon: UserCheck },
                  ].map((t) => {
                    const Icon = t.icon;
                    const isActive = activeEvalTab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveEvalTab(t.id as any)}
                        className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${isActive
                          ? "bg-[#233249] text-white shadow-2xs"
                          : "bg-white border border-[#E2E6EE] text-[#647084] hover:bg-neutral-50"
                          }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Right Scrollable Body Content */}
                <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 thin-scrollbar">
                  {/* TAB 1: Risk Audit */}
                  {activeEvalTab === "risk_audit" && (
                    <div className="flex flex-col gap-3 text-xs">
                      <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-3.5">
                        <strong className="text-rose-800 block mb-1 font-bold">
                          Examiner Constructive Warning:
                        </strong>
                        <p className="text-neutral-700 leading-relaxed">
                          {reviewEval.executive_summary}
                        </p>
                      </div>
                      <div className="space-y-2">
                        {reviewEval.risk_analysis?.vulnerabilities.map((v, i) => (
                          <div
                            key={i}
                            className="rounded-xl border border-[#E2E6EE] bg-[#F8FAFC] p-3 border-l-4 border-l-rose-500"
                          >
                            <div className="font-bold text-[#1F314D] mb-1">{v.type}</div>
                            <p className="text-[#647084]">{v.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: Where Missed */}
                  {activeEvalTab === "where_missed" && (
                    <div className="flex flex-col gap-3 text-xs">
                      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-3.5">
                        <strong className="text-indigo-900 block mb-1 font-bold">
                          Primary Cognitive Blindspot:
                        </strong>
                        <p className="text-neutral-700">
                          {reviewEval.root_cause_analysis?.primary_failure_mode}
                        </p>
                      </div>

                      <div>
                        <strong className="text-[#1F314D] block mb-2 font-bold">
                          Missed Authoritative Anchors:
                        </strong>
                        <div className="flex flex-wrap gap-1.5">
                          {reviewEval.root_cause_analysis?.missed_authoritative_anchors.map(
                            (a, i) => (
                              <span
                                key={i}
                                className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700 font-semibold"
                              >
                                + {a}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: How To Fix */}
                  {activeEvalTab === "how_to_fix" && (
                    <div className="flex flex-col gap-3 text-xs">
                      <div className="rounded-2xl border border-[#E2E6EE] bg-[#F8FAFC] p-3.5 space-y-1.5">
                        <strong className="text-amber-700 block mb-2 font-bold">
                          4-Phase Score Leap Blueprint:
                        </strong>
                        <div><strong>Phase 1:</strong> {reviewEval.remedial_blueprint?.phase_1_immediate_fix}</div>
                        <div><strong>Phase 2:</strong> {reviewEval.remedial_blueprint?.phase_2_body_overhaul}</div>
                        <div><strong>Phase 3:</strong> {reviewEval.remedial_blueprint?.phase_3_evidence_injection}</div>
                        <div><strong>Phase 4:</strong> {reviewEval.remedial_blueprint?.phase_4_conclusion_upgrade}</div>
                      </div>

                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5">
                        <strong className="text-emerald-800 block mb-1 font-bold">
                          Topper Gold Booster Lines:
                        </strong>
                        <ul className="list-disc pl-4 space-y-1 text-neutral-700">
                          {reviewEval.remedial_blueprint?.topper_gold_booster_lines.map((l, i) => (
                            <li key={i}>{l}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: Pillars Radar */}
                  {activeEvalTab === "pillars_radar" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
                      {reviewEval.pillars_360 &&
                        Object.entries(reviewEval.pillars_360).map(([k, val]) => (
                          <div key={k} className="rounded-xl border border-[#E2E6EE] bg-[#F8FAFC] p-3">
                            <div className="flex justify-between font-semibold text-[#647084] capitalize mb-1.5">
                              <span>{k.replace("_", " ")}</span>
                              <span className="text-[#1F314D] font-bold">{val}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#0F7F8C]"
                                style={{ width: `${val}%` }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* TAB 5: SME Feedback */}
                  {activeEvalTab === "sme_feedback" && (
                    <div className="flex flex-col gap-3 text-xs">
                      <div className="rounded-2xl border border-[#E2E6EE] bg-[#F8FAFC] p-3.5">
                        <strong className="text-indigo-900 block font-bold mb-1">
                          {reviewEval.sme_feedback?.board_lead_examiner?.title}
                        </strong>
                        <p className="text-neutral-700">
                          {reviewEval.sme_feedback?.board_lead_examiner?.examiner_psychology_tip}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[#E2E6EE] bg-[#F8FAFC] p-3.5">
                        <strong className="text-emerald-800 block font-bold mb-1">
                          {reviewEval.sme_feedback?.revision_mentor?.title}
                        </strong>
                        <p className="text-neutral-700">
                          {reviewEval.sme_feedback?.revision_mentor?.score_leap_strategy}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* AI Brainstorm Insights Card */}
                  {reviewBrainstorm && (
                    <div className="rounded-3xl border border-sky-200 bg-sky-50/40 p-4 shadow-xs flex flex-col gap-3">
                      <h4 className="text-sm font-bold text-sky-900 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-sky-600" />
                        <span>AI Brainstormer Framework & Model Insights</span>
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                        {reviewBrainstorm.deconstruction && (
                          <div className="rounded-xl bg-white p-3 border border-sky-100">
                            <strong className="text-sky-900 block mb-1">Deconstruction</strong>
                            <p className="text-neutral-700">{reviewBrainstorm.deconstruction.literal_meaning}</p>
                          </div>
                        )}
                        {reviewBrainstorm.dialectical_tensions && (
                          <div className="rounded-xl bg-white p-3 border border-sky-100">
                            <strong className="text-sky-900 block mb-1">Dialectical Tension</strong>
                            <p className="text-neutral-700">
                              <strong>Thesis:</strong> {reviewBrainstorm.dialectical_tensions[0]?.thesis} <br />
                              <strong>Antithesis:</strong> {reviewBrainstorm.dialectical_tensions[0]?.antithesis}
                            </p>
                          </div>
                        )}
                      </div>

                      {reviewBrainstorm.recommended_thinkers && (
                        <div className="rounded-xl bg-white p-3 border border-sky-100 text-xs">
                          <strong className="text-sky-900 block mb-1">Recommended Thinkers / Committees:</strong>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {reviewBrainstorm.recommended_thinkers.map((th: string, idx: number) => (
                              <span key={idx} className="rounded-md bg-sky-100 px-2 py-0.5 text-sky-800 text-[11px] font-semibold">
                                {th}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-xs text-[#647084]">
                No evaluation available for this question.
              </div>
            )}
          </div>
        </div>

        {/* Revision Workspace Modal for post-test */}
        <RevisionWorkspaceModal
          isOpen={isRevisionModalOpen}
          onClose={() => setIsRevisionModalOpen(false)}
          activeQuestion={reviewQ}
          v1Text={reviewAnswer}
          v1Evaluation={reviewEval}
          onSaveRevision={(revised, delta) => {
            setAnswers((prev) => ({ ...prev, [reviewQ.id]: revised }));
            if (delta) {
              setEvaluationsByQuestion((prev) => ({
                ...prev,
                [reviewQ.id]: prev[reviewQ.id]
                  ? { ...prev[reviewQ.id], delta_analysis: delta }
                  : prev[reviewQ.id],
              }));
            }
          }}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // IN-EXAM 2-COLUMN HORIZONTAL SPLIT (GRID-2) VIEW
  // -------------------------------------------------------------
  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      {/* Top Banner & Timer Bar */}
      <div className="shrink-0 rounded-3xl border border-[#E2E6EE] bg-white p-4 md:p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onBackToPapers}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E6EE] bg-[#F8FAFC] text-[#1F314D] hover:bg-neutral-100 transition"
              title="Back to Papers List"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            {onFinishToAnalytics && (
              <button
                type="button"
                onClick={onFinishToAnalytics}
                className="flex items-center gap-1.5 rounded-xl border border-[#0F7F8C]/20 bg-[#0F7F8C]/10 px-3 py-1.5 text-xs font-bold text-[#0F7F8C] hover:bg-[#0F7F8C]/20 transition shadow-2xs"
                title="Finish & Go to Mains 360 Analytics"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span>Finish to Analytics</span>
              </button>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {paper.paper_year && (
                  <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-[#1F314D]">
                    {paper.paper_year} Paper
                  </span>
                )}
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  {questions.length} Questions
                </span>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                  Attempted: {attemptedCount}/{questions.length}
                </span>
              </div>
              <h2 className="text-lg md:text-xl font-bold text-[#1F314D] mt-0.5">
                {paper.paper_name}
              </h2>
            </div>
          </div>

          {/* Master Timer & Submit Controls */}
          <div className="flex items-center gap-2.5">
            <div
              className={`flex items-center gap-2 rounded-2xl border px-3.5 py-1.5 font-mono text-lg font-bold ${secondsRemaining < 900
                ? "border-rose-300 bg-rose-50 text-rose-600"
                : "border-[#E2E6EE] bg-[#F8FAFC] text-[#1F314D]"
                }`}
            >
              <Clock className="h-4 w-4 text-[#0F7F8C]" />
              <span>{formatTimer(secondsRemaining)}</span>
            </div>

            <Button
              type="button"
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className={`rounded-2xl text-xs font-semibold h-10 px-3.5 ${isTimerRunning
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-[#0F7F8C] hover:bg-[#0c6b76] text-white"
                }`}
            >
              {isTimerRunning ? (
                <>
                  <Pause className="mr-1.5 h-3.5 w-3.5" /> Pause
                </>
              ) : (
                <>
                  <Play className="mr-1.5 h-3.5 w-3.5" /> Resume Clock
                </>
              )}
            </Button>

            <Button
              type="button"
              onClick={handleSubmitFullPaper}
              className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-4 text-xs shadow-xs"
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              <span>Submit & Finish</span>
            </Button>
          </div>
        </div>

        {/* Compact Question Switcher Bar */}
        <div className="mt-4 border-t border-[#E2E6EE] pt-3 flex items-center justify-between gap-3 overflow-x-auto pb-1">
          <div className="flex items-center gap-2 overflow-x-auto py-1 px-1">
            {questions.map((q, idx) => {
              const isCurrent = activeQIndex === idx;
              const isAttempted = (answers[q.id] || "").trim().length > 0;
              const isFlag = flagged[q.id];

              let bgClass = "bg-[#F8FAFC] border-[#E2E6EE] text-[#1F314D] hover:bg-neutral-100";
              if (isAttempted) {
                bgClass = "bg-emerald-50 border-emerald-300 text-emerald-800 font-bold";
              }
              if (isFlag) {
                bgClass = "bg-amber-100 border-amber-300 text-amber-800 font-bold";
              }
              if (isCurrent) {
                bgClass += " !border-[#0F7F8C] !bg-[#0F7F8C]/10 !text-[#0F7F8C] font-bold border-2 shadow-xs";
              }

              return (
                <button
                  key={q.id || idx}
                  type="button"
                  onClick={() => setActiveQIndex(idx)}
                  className={`flex h-8 px-3 shrink-0 items-center justify-center rounded-xl border text-xs font-semibold transition ${bgClass}`}
                >
                  Q{idx + 1}
                </button>
              );
            })}
          </div>

          <div className="shrink-0 flex items-center gap-2 text-[11px] text-[#647084]">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Attempted: {attemptedCount}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Flagged: {Object.keys(flagged).filter((k) => flagged[k]).length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Student Workspace: 2-Column Split (Equal Height, Fit Screen, Internal Scroll Alone) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1 min-h-0 items-stretch">
        {/* LEFT COLUMN: Question Statement, Instructions, Maps/Diagrams, Subquestions */}
        <div className="rounded-3xl border border-l-4 border-l-[#0F7F8C] border-[#E2E6EE] bg-[#F8FAFC] shadow-xs flex flex-col h-full min-h-0 overflow-hidden">
          {/* Left Header (Fixed) */}
          <div className="shrink-0 p-5 border-b border-[#E2E6EE] bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-full bg-[#1F314D] px-3 py-1 text-xs font-bold text-white">
                Question {currentQ.question_number || activeQIndex + 1} of {questions.length}
              </span>
              {currentQ.section && (
                <span className="rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
                  {currentQ.section}
                </span>
              )}
              <span className="rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                {currentQ.marks || "10"} Marks ({targetWords} Words)
              </span>
              {currentQ.subquestions && currentQ.subquestions.length > 0 && (
                <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-800">
                  {currentQ.subquestions.length} Points
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {currentQ.text_hi && (
                <button
                  type="button"
                  onClick={() => setShowHindi(!showHindi)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${showHindi
                    ? "bg-teal-50 border-teal-200 text-[#0F7F8C]"
                    : "bg-white border-[#E2E6EE] text-[#647084] hover:bg-neutral-50"
                    }`}
                  title="Toggle Hindi translation"
                >
                  <Languages className="h-3.5 w-3.5" />
                  <span>हिंदी {showHindi ? "On" : "Off"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  setFlagged((prev) => ({
                    ...prev,
                    [currentQ.id]: !prev[currentQ.id],
                  }))
                }
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition border shadow-2xs ${flagged[currentQ.id]
                  ? "bg-amber-100 border-amber-300 text-amber-800"
                  : "bg-white border-[#E2E6EE] text-[#647084] hover:bg-neutral-50"
                  }`}
              >
                {flagged[currentQ.id] ? "🚩 Flagged" : "Flag"}
              </button>
            </div>
          </div>

          {/* Left Content (Internal Scroll Alone) */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 thin-scrollbar">
            {/* Primary Question Statement (English) */}
            <div className="space-y-1.5">
              {currentQ.text_en ? (
                <p className="text-base font-semibold text-[#1F314D] leading-relaxed">
                  {currentQ.text_en}
                </p>
              ) : currentQ.subquestions && currentQ.subquestions.length > 0 ? (
                <p className="text-sm font-medium text-[#647084] italic">
                  Answer the individual subquestions listed below:
                </p>
              ) : null}

              {/* Optional Hindi translation */}
              {showHindi && currentQ.text_hi && (
                <p className="text-sm font-normal text-neutral-600 leading-relaxed pt-1.5 border-t border-[#E2E6EE]/70">
                  {currentQ.text_hi}
                </p>
              )}
            </div>

            {/* Diagrams / Maps if provided */}
            {currentQ.diagrams && currentQ.diagrams.length > 0 && (
              <div className="space-y-2 border-t border-[#E2E6EE] pt-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1F314D]">
                  <ImageIcon className="h-4 w-4 text-[#0F7F8C]" />
                  <span>Question Maps & Diagrams ({currentQ.diagrams.length})</span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {currentQ.diagrams.map((diag, dIdx) => {
                    const imgSrc = diag.data_url || diag.url || diag.image_url || "";
                    const imgTitle = diag.title || diag.name || `Diagram ${dIdx + 1}`;
                    if (!imgSrc) return null;

                    return (
                      <div
                        key={diag.id || dIdx}
                        className="group relative rounded-2xl border border-[#E2E6EE] bg-white p-2.5 shadow-2xs hover:shadow-md transition overflow-hidden"
                      >
                        <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl bg-neutral-100 flex items-center justify-center">
                          <img
                            src={imgSrc}
                            alt={imgTitle}
                            className="h-full w-full object-contain transition group-hover:scale-102"
                            loading="lazy"
                          />
                          <button
                            type="button"
                            onClick={() => setPreviewImage({ url: imgSrc, title: imgTitle })}
                            className="absolute bottom-2 right-2 flex items-center gap-1 rounded-xl bg-[#1F314D]/90 text-white px-2.5 py-1 text-xs font-semibold backdrop-blur-xs opacity-90 hover:opacity-100 transition shadow-md"
                          >
                            <ZoomIn className="h-3.5 w-3.5" />
                            <span>Expand Map</span>
                          </button>
                        </div>
                        <div className="mt-2 flex items-center justify-between px-1">
                          <span className="text-xs font-semibold text-[#1F314D] truncate">
                            {imgTitle}
                          </span>
                          {diag.width && diag.height && (
                            <span className="text-[10px] text-[#647084]">
                              {diag.width} × {diag.height}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Formulas if any */}
            {currentQ.latex_formulas && currentQ.latex_formulas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {currentQ.latex_formulas.map((form) => (
                  <span
                    key={form.id || form.latex}
                    className="rounded-lg bg-indigo-50/70 border border-indigo-100 px-2.5 py-1 font-mono text-xs text-indigo-800"
                  >
                    {form.latex}
                  </span>
                ))}
              </div>
            )}

            {/* Subquestions List (e.g. Map hints 1(i) to 1(xx)) */}
            {currentQ.subquestions && currentQ.subquestions.length > 0 && (
              <div className="border-t border-[#E2E6EE] pt-3">
                <div className="flex items-center justify-between mb-2.5">
                  <button
                    type="button"
                    onClick={() => setIsSubquestionsExpanded(!isSubquestionsExpanded)}
                    className="flex items-center gap-2 text-xs font-bold text-[#1F314D] hover:text-[#0F7F8C] transition"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#0F7F8C]/10 text-[#0F7F8C]">
                      {isSubquestionsExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <span>
                      Subquestions & Locational Points ({currentQ.subquestions.length} items)
                    </span>
                  </button>
                  <span className="text-[11px] text-[#647084]">
                    {isSubquestionsExpanded ? "Collapse" : "Expand"}
                  </span>
                </div>

                {isSubquestionsExpanded && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1 pb-2">
                    {currentQ.subquestions.map((sub, sIdx) => {
                      const subNum = sub.subquestion_number || sub.label || `(${sIdx + 1})`;
                      const subTextEn = sub.text_en || sub.text || "";
                      const subTextHi = sub.text_hi || "";

                      return (
                        <div
                          key={sIdx}
                          className="rounded-xl border border-[#E2E6EE] bg-white p-2.5 hover:border-[#0F7F8C]/40 transition flex flex-col justify-between gap-1 shadow-2xs"
                        >
                          <div className="flex items-start gap-2">
                            <span className="shrink-0 rounded-md bg-[#1F314D]/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#1F314D]">
                              {subNum}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[#1F314D] leading-snug">
                                {subTextEn}
                              </p>
                              {showHindi && subTextHi && (
                                <p className="text-[11px] text-[#647084] font-normal leading-snug mt-0.5">
                                  {subTextHi}
                                </p>
                              )}
                            </div>
                          </div>
                          {sub.marks && (
                            <div className="text-right">
                              <span className="inline-block rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                {sub.marks} marks
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: UPSC QCAB Answer Sheet / Writing Area (Equal Height, Scroll Inside) */}
        <div className="rounded-3xl border border-[#E2E6EE] bg-white shadow-xs flex flex-col h-full min-h-0 overflow-hidden">
          {/* Right Header (Fixed) */}
          <div className="shrink-0 p-5 border-b border-[#E2E6EE] bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PenTool className="h-4 w-4 text-[#0F7F8C]" />
              <h3 className="text-sm font-bold text-[#1F314D]">
                Answer Writing Sheet (UPSC QCAB Format)
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs text-[#647084]">
                Word count:{" "}
                <strong
                  className={
                    wordCount > targetWords * 1.15
                      ? "text-rose-600"
                      : "text-[#1F314D]"
                  }
                >
                  {wordCount}
                </strong>{" "}
                / {targetWords}
              </div>

              <button
                type="button"
                onClick={() => setIsOCRModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-[#E2E6EE] bg-white px-3 py-1.5 text-xs font-semibold text-[#1F314D] hover:bg-neutral-50 transition shadow-2xs"
                title="Scan handwritten pages via OCR"
              >
                <Camera className="h-3.5 w-3.5 text-[#0F7F8C]" />
                <span>OCR Ingest</span>
              </button>
            </div>
          </div>

          {/* Right Textarea Area (Flex-1, fills the rest, internal scroll) */}
          <div className="flex-1 min-h-0 p-5 flex flex-col">
            <textarea
              className="w-full h-full flex-1 min-h-0 rounded-2xl border border-[#E2E6EE] bg-[#FAFAFA] p-4 text-sm leading-relaxed text-[#1F314D] focus:border-[#0F7F8C] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F7F8C] font-mono resize-none overflow-y-auto thin-scrollbar"
              value={currentText}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="Write your answer here in official UPSC structure (Introduction, Body Dimensions with headings/data, Balanced Conclusion)... or upload handwritten sheets via OCR Ingest."
            />
          </div>

          {/* Bottom Question Stepper Controls (Fixed at bottom) */}
          <div className="shrink-0 px-5 py-3.5 border-t border-[#E2E6EE] bg-white flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveQIndex((prev) => Math.max(0, prev - 1))}
                disabled={activeQIndex === 0}
                className="rounded-xl border-[#E2E6EE] text-xs font-medium h-10 px-4"
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Previous Question
              </Button>
              {onFinishToAnalytics && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onFinishToAnalytics}
                  className="rounded-xl border-[#0F7F8C]/20 bg-[#0F7F8C]/5 text-[#0F7F8C] hover:bg-[#0F7F8C]/15 text-xs font-bold h-10 px-3.5"
                  title="Finish and return to Mains 360 Analytics"
                >
                  <BarChart3 className="mr-1.5 h-4 w-4" /> Finish
                </Button>
              )}
            </div>

            <span className="text-xs font-semibold text-[#647084]">
              {activeQIndex + 1} of {questions.length}
            </span>

            {activeQIndex < questions.length - 1 ? (
              <Button
                type="button"
                onClick={() => setActiveQIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="rounded-xl bg-[#233249] hover:bg-[#1a2536] text-white text-xs font-semibold h-10 px-4"
              >
                Next Question <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmitFullPaper}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-10 px-4"
              >
                <Send className="mr-1.5 h-3.5 w-3.5" /> Finish & Submit Test
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* OCR Scanner Modal */}
      <OCRScannerModal
        isOpen={isOCRModalOpen}
        onClose={() => setIsOCRModalOpen(false)}
        onTextExtracted={(text) => handleAnswerChange(text)}
      />

      {/* Diagram Zoom Preview Lightbox Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative max-h-[92vh] max-w-4xl w-full rounded-3xl bg-white p-4 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#E2E6EE] pb-3 mb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-[#0F7F8C]" />
                <h3 className="text-sm font-bold text-[#1F314D] truncate">
                  {previewImage.title || "Question Diagram / Map"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-100 text-[#647084] hover:bg-neutral-200 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-neutral-50 rounded-2xl p-2 max-h-[75vh]">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-full max-w-full object-contain rounded-lg"
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-[#647084] px-1">
              <span>Use scroll or pinch to inspect locational details</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreviewImage(null)}
                className="rounded-xl"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
