"use client";

import React, { useEffect, useState } from "react";
import {
  Award,
  Target,
  Layers,
  Sparkles,
  Clock,
  FileText,
  Eye,
  RefreshCw,
  X,
  PenTool,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMainsAnalyticsApi, getMainsAttemptsApi } from "@/lib/mains360-api";

interface MasteryAnalyticsProps {
  onStartDrill?: () => void;
}

export function MasteryAnalytics({ onStartDrill }: MasteryAnalyticsProps) {
  const [data, setData] = useState<any>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAttempt, setSelectedAttempt] = useState<any | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      const [analyticsRes, attemptsRes] = await Promise.allSettled([
        getMainsAnalyticsApi(),
        getMainsAttemptsApi(),
      ]);

      if (analyticsRes.status === "fulfilled" && analyticsRes.value?.data) {
        setData(analyticsRes.value.data);
      }
      if (attemptsRes.status === "fulfilled" && attemptsRes.value?.attempts) {
        setAttempts(attemptsRes.value.attempts);
      }
    } catch (err) {
      console.error("Error loading analytics & attempts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const [analyticsRes, attemptsRes] = await Promise.allSettled([
          getMainsAnalyticsApi(),
          getMainsAttemptsApi(),
        ]);
        if (ignore) return;
        if (analyticsRes.status === "fulfilled" && analyticsRes.value?.data) {
          setData(analyticsRes.value.data);
        }
        if (attemptsRes.status === "fulfilled" && attemptsRes.value?.attempts) {
          setAttempts(attemptsRes.value.attempts);
        }
      } catch (err) {
        console.error("Error loading analytics & attempts:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  const paperProgress = data?.paperProgress && data.paperProgress.length > 0
    ? data.paperProgress
    : [
      { code: "GS-I", title: "Heritage, History, Geography, Society", progress: 0, answers: 0, color: "#10B981" },
      { code: "GS-II", title: "Governance, Constitution, Polity, IR", progress: 0, answers: 0, color: "#6366F1" },
      { code: "GS-III", title: "Economy, Agriculture, S&T, Environment", progress: 0, answers: 0, color: "#0EA5E9" },
      { code: "GS-IV", title: "Ethics, Integrity, Aptitude & Cases", progress: 0, answers: 0, color: "#F43F5E" },
      { code: "Essay", title: "Philosophical & Socio-Economic", progress: 0, answers: 0, color: "#F59E0B" },
    ];

  const directiveMastery = data?.directiveMastery || [
    { directive: "Critically Analyze", mastery: "0%", status: "Needs Practice", desc: "Balances pro/con arguments with structural limitations." },
    { directive: "Examine", mastery: "0%", status: "Developing", desc: "Probes deep into underlying causes and legal provisions." },
    { directive: "Discuss", mastery: "0%", status: "Developing", desc: "Broad multidimensional PESTLE coverage." },
    { directive: "Evaluate", mastery: "0%", status: "Needs Practice", desc: "Criteria-based judgment and counter-arguments." },
    { directive: "Elucidate / Comment", mastery: "0%", status: "Developing", desc: "Clarifies core quote with relevant historical anecdotes." },
  ];

  const recentAttemptsList = attempts.length > 0 ? attempts : (data?.recentAttempts || []);

  const totalEvaluated = data?.totalEvaluated || attempts.reduce((acc, a) => acc + (a.attemptedCount || 0), 0);
  const avgScore = data?.avgScore ?? (attempts.length > 0 ? Math.round(attempts.reduce((acc, a) => acc + (a.scorePct || 0), 0) / attempts.length) : 0);

  return (
    <div className="flex flex-col gap-6 pb-20">
      {/* Top Banner */}
      <div className="rounded-3xl border border-[#E2E6EE] bg-white p-5 md:p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                360° Real-time Feedback Loop
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-[#1F314D]">
              Personalized Mains Mastery & Gap Analytics Dashboard
            </h2>
            <p className="text-xs text-[#647084]">
              Tracking real paper attempts, syllabus topic coverage, and AI diagnostic reports.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E2E6EE] bg-[#F8FAFC] text-[#647084] hover:bg-neutral-100 transition shadow-2xs"
              title="Refresh database analytics"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-[#0F7F8C]" : ""}`} />
            </button>
            <div className="rounded-2xl border border-[#E2E6EE] bg-[#F8FAFC] px-4 py-2.5 text-center">
              <div className="text-xl font-extrabold text-[#1F314D]">
                {totalEvaluated}
              </div>
              <div className="text-[11px] text-[#647084]">Answers Evaluated</div>
            </div>
            <div className="rounded-2xl border border-[#E2E6EE] bg-[#F8FAFC] px-4 py-2.5 text-center">
              <div className="text-xl font-extrabold text-emerald-600">
                {avgScore}%
              </div>
              <div className="text-[11px] text-[#647084]">Avg Score Index</div>
            </div>
          </div>
        </div>
      </div>

      {/* RECENT TEST RESULTS VIEW SECTION */}
      <div className="rounded-3xl border border-[#E2E6EE] bg-white p-5 md:p-6 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-[#E2E6EE] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-bold text-[#1F314D]">
                Recent Paper Mock Attempts & AI Test Results
              </h3>
              <p className="text-xs text-[#647084]">
                Detailed scores, answers, and examiner evaluations stored in database
              </p>
            </div>
          </div>

          <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-bold text-[#1F314D]">
            {recentAttemptsList.length} Attempt(s)
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-[#0F7F8C]" />
            <span className="text-xs text-[#647084]">Fetching mock test results from database...</span>
          </div>
        ) : recentAttemptsList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E2E6EE] bg-[#F8FAFC] p-8 text-center flex flex-col items-center justify-center gap-3">
            <Award className="h-10 w-10 text-neutral-300" />
            <div>
              <p className="text-sm font-bold text-[#1F314D]">No mock test attempts recorded yet</p>
              <p className="text-xs text-[#647084] mt-0.5">
                Take a paper test in the Mains 360 Simulator and submit to see full AI diagnostics here.
              </p>
            </div>
            {onStartDrill && (
              <Button
                type="button"
                onClick={onStartDrill}
                className="mt-2 rounded-xl bg-[#233249] text-white text-xs font-bold px-4"
              >
                Go to Question Papers
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentAttemptsList.map((att: any) => {
              const dateStr = att.createdAt ? new Date(att.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }) : "Recent";

              return (
                <div
                  key={att.id}
                  className="rounded-2xl border border-[#E2E6EE] bg-[#F8FAFC] hover:bg-white hover:border-[#0F7F8C]/40 p-4 transition shadow-2xs flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-emerald-600">
                        {att.scorePct || 0}% Score
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-[#1F314D] line-clamp-1">
                      {att.paperTitle || "UPSC Mains Simulation"}
                    </h4>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-[#647084]">
                      <div className="bg-white rounded-lg p-1.5 border border-[#E2E6EE]">
                        Marks: <strong className="text-[#1F314D]">{att.totalMarks || 0} / {att.totalMaxMarks || 100}</strong>
                      </div>
                      <div className="bg-white rounded-lg p-1.5 border border-[#E2E6EE]">
                        Attempted: <strong className="text-[#1F314D]">{att.attemptedCount || 0} Qs</strong>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#647084]">
                      <Clock className="h-3 w-3" />
                      <span>{dateStr}</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedAttempt(att)}
                    className="w-full rounded-xl border-[#E2E6EE] bg-white hover:bg-teal-50 hover:text-[#0F7F8C] hover:border-teal-300 text-xs font-semibold text-[#1F314D] transition h-9 flex items-center justify-center gap-1.5"
                  >
                    <Eye className="h-3.5 w-3.5 text-[#0F7F8C]" />
                    <span>View Test Result & AI Report</span>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid: Syllabus Progress (Left) & Directive Mastery (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Syllabus Progress */}
        <div className="rounded-3xl border border-[#E2E6EE] bg-white p-5 md:p-6 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#E2E6EE] pb-3">
            <h3 className="text-sm font-bold text-[#1F314D] flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#0F7F8C]" />
              <span>Syllabus Micro-Topic Coverage</span>
            </h3>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
              Avg: {avgScore}%
            </span>
          </div>

          <div className="space-y-3.5">
            {paperProgress.map((p: any, idx: number) => {
              const hasProgress = (p.progress || 0) > 0;
              return (
                <div key={idx} className="space-y-1.5 text-xs">
                  <div className="flex justify-between font-medium">
                    <span className="text-[#1F314D] font-bold">{p.code} ({p.title.split(",")[0]})</span>
                    <span className={hasProgress ? "text-[#647084]" : "text-neutral-400"}>
                      {p.progress || 0}% ({p.answers || 0} answers)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
                    {hasProgress ? (
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${p.progress}%`, backgroundColor: p.color || "#0F7F8C" }}
                      />
                    ) : (
                      <div className="h-full w-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Directive Mastery */}
        <div className="rounded-3xl border border-[#E2E6EE] bg-white p-5 md:p-6 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#E2E6EE] pb-3">
            <h3 className="text-sm font-bold text-[#1F314D] flex items-center gap-2">
              <Target className="h-4 w-4 text-[#0F7F8C]" />
              <span>Directive & Command Word Mastery</span>
            </h3>
          </div>

          <div className="space-y-2.5">
            {directiveMastery.map((item: any, idx: number) => (
              <div
                key={idx}
                className="rounded-2xl border border-[#E2E6EE] bg-[#F8FAFC] p-3 text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#1F314D]">{item.directive}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-emerald-600">
                      {item.mastery}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      {item.status}
                    </span>
                  </div>
                </div>
                <p className="text-[#647084]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* POPUP MODAL: DETAILED ATTEMPT RESULT & AI DIAGNOSTIC REPORT */}
      {selectedAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative max-h-[92vh] max-w-4xl w-full rounded-3xl bg-white shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E2E6EE] p-5 bg-[#F8FAFC]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1F314D]">
                    {selectedAttempt.paperTitle || "Mains Paper Diagnostic Result"}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-[#647084] mt-0.5">
                    <span>Score: <strong className="text-emerald-700">{selectedAttempt.totalMarks} / {selectedAttempt.totalMaxMarks} M ({selectedAttempt.scorePct}%)</strong></span>
                    <span>•</span>
                    <span>Attempted: <strong>{selectedAttempt.attemptedCount} Qs</strong></span>
                    <span>•</span>
                    <span>Time: <strong>{selectedAttempt.timeElapsedMins || 0} mins</strong></span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAttempt(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-200 text-[#647084] hover:bg-neutral-300 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            {(() => {
              const evaluationsList = Object.values(selectedAttempt.evaluationReport?.evaluations || {});
              const hasEvals = evaluationsList.length > 0;
              const dynamicAwardedSum = hasEvals
                ? Number(evaluationsList.reduce((acc: number, curr: any) => acc + (typeof curr.awarded_marks === "number" ? curr.awarded_marks : 0), 0).toFixed(1))
                : (selectedAttempt.totalMarks || 0);
              const effectiveMaxMarks = selectedAttempt.totalMaxMarks || 100;
              const dynamicPct = Math.round((dynamicAwardedSum / (effectiveMaxMarks || 1)) * 100);

              const entries = Object.entries(selectedAttempt.answersJson || {});

              const getQuestionNumber = (qId: string, evObj: any) => {
                // 1. Explicit question_number property if available in evaluation
                if (evObj?.question_number) {
                  const m = String(evObj.question_number).match(/\d+/);
                  if (m) return parseInt(m[0], 10);
                }

                // 2. Detect targeted sub-question format in recommendations (e.g., "Structure 4(a)", "For 2(a)", "For 7(b)")
                const boosterLines = evObj?.remedial_blueprint?.topper_gold_booster_lines || evObj?.examiner_recommendations || [];
                for (const line of boosterLines) {
                  const subMatch = line.match(/(?:Structure|For)\s*(\d+)\s*\([a-z]\)/i);
                  if (subMatch) return parseInt(subMatch[1], 10);
                  const underMatch = line.match(/under Question\s*(\d+)/i);
                  if (underMatch) return parseInt(underMatch[1], 10);
                  const forQMatch = line.match(/For Question\s*(\d+)/i);
                  if (forQMatch) return parseInt(forQMatch[1], 10);
                }

                // 3. Detect question number directly referenced in examiner's executive summary
                const summary = evObj?.executive_summary || "";
                const targetMatch = summary.match(/(?:answering|addressing|drafting|attempt any part of|part of|evaluation of)\s*(?:the given\s*)?Question\s*(\d+)/i)
                  || summary.match(/under Question\s*(\d+)/i)
                  || summary.match(/instead of Question\s*(\d+)/i);
                if (targetMatch) return parseInt(targetMatch[1], 10);

                // 4. Special standard UPSC pattern heuristics
                if (boosterLines.some((l: string) => l.includes("150-word sub-questions") || l.includes("150 words"))) {
                  return 5;
                }
                if (boosterLines.some((l: string) => l.includes("20 map locations") || l.includes("20 map points") || l.includes("standard UPSC map sites"))) {
                  return 1;
                }

                return 999;
              };

              const sortedEntries = [...entries].sort(([idA], [idB]) => {
                const evA = selectedAttempt.evaluationReport?.evaluations?.[idA];
                const evB = selectedAttempt.evaluationReport?.evaluations?.[idB];
                return getQuestionNumber(idA, evA) - getQuestionNumber(idB, evB);
              });

              return (
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  {/* Performance stats summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E6EE] p-3">
                      <span className="text-[10px] text-[#647084] uppercase font-semibold">Awarded Score</span>
                      <div className="text-lg font-bold text-[#1F314D] mt-0.5">{dynamicAwardedSum} M</div>
                    </div>
                    <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E6EE] p-3">
                      <span className="text-[10px] text-[#647084] uppercase font-semibold">Max Score</span>
                      <div className="text-lg font-bold text-[#1F314D] mt-0.5">{effectiveMaxMarks} M</div>
                    </div>
                    <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E6EE] p-3">
                      <span className="text-[10px] text-[#647084] uppercase font-semibold">Score Pct</span>
                      <div className="text-lg font-bold text-emerald-600 mt-0.5">{dynamicPct}%</div>
                    </div>
                    <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E6EE] p-3">
                      <span className="text-[10px] text-[#647084] uppercase font-semibold">Duration</span>
                      <div className="text-lg font-bold text-[#1F314D] mt-0.5">{selectedAttempt.timeElapsedMins || 0} mins</div>
                    </div>
                  </div>

              {/* Questions & Evaluated Answers */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-[#1F314D] flex items-center gap-2">
                  <PenTool className="h-4 w-4 text-[#0F7F8C]" />
                  <span>Submitted Question Answers & Examiner Findings</span>
                </h4>

                {sortedEntries.length === 0 ? (
                  <p className="text-xs text-[#647084] italic">No answer drafts recorded for this attempt.</p>
                ) : (
                  sortedEntries.map(([qId, ansText], idx) => {
                    const ev = selectedAttempt.evaluationReport?.evaluations?.[qId];
                    const detectedNum = getQuestionNumber(qId, ev);
                    const displayQuestionNumber = detectedNum < 999 ? detectedNum : idx + 1;

                      const awardedMarks = ev?.awarded_marks !== undefined ? ev.awarded_marks : null;
                      const maxMarks = ev?.max_marks || 10;
                      const overallIndex = ev?.overall_360_index;
                      const overallBand = ev?.overall_band;

                      return (
                        <div
                          key={qId}
                          className="rounded-2xl border border-[#E2E6EE] bg-[#F8FAFC] p-4 sm:p-5 flex flex-col gap-3.5 shadow-2xs"
                        >
                          {/* Question Header & Score Pill */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E6EE] pb-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="rounded-full bg-[#1F314D] px-2.5 py-0.5 text-xs font-bold text-white">
                                Question {displayQuestionNumber}
                              </span>
                              {overallBand && (
                                <span className="rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                  {overallBand}
                                </span>
                              )}
                              {overallIndex !== undefined && (
                                <span className="rounded-full bg-teal-50 border border-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
                                  Quality: {overallIndex}/100
                                </span>
                              )}
                            </div>
                            {awardedMarks !== null && (
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                awardedMarks > 0 
                                  ? "bg-emerald-100 text-emerald-800" 
                                  : "bg-neutral-100 text-neutral-700"
                              }`}>
                                Score: {awardedMarks} / {maxMarks} Marks
                              </span>
                            )}
                          </div>

                        {/* Candidate Answer */}
                        <div>
                          <span className="text-[11px] font-bold text-[#647084] uppercase tracking-wider block mb-1">
                            Your QCAB Answer Draft:
                          </span>
                          <div className="rounded-xl bg-white border border-[#E2E6EE] p-3 text-xs text-[#1F314D] leading-relaxed whitespace-pre-wrap font-mono max-h-48 overflow-y-auto thin-scrollbar">
                            {String(ansText || "No answer written")}
                          </div>
                        </div>

                        {/* AI Examiner Critique & 360 Insights */}
                        {ev && (
                          <div className="space-y-2.5 mt-1">
                            {/* Executive Critique */}
                            {ev.executive_summary && (
                              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-950">
                                <strong className="text-indigo-900 block mb-1 font-bold">Examiner Evaluation:</strong>
                                <p className="leading-relaxed">{ev.executive_summary}</p>
                              </div>
                            )}

                            {/* Cognitive Blindspots / Missed Anchors */}
                            {(ev.root_cause_analysis?.primary_failure_mode || ev.root_cause_analysis?.missed_authoritative_anchors?.length) && (
                              <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3 text-xs text-neutral-800">
                                {ev.root_cause_analysis?.primary_failure_mode && (
                                  <p className="mb-1.5">
                                    <strong className="text-rose-900 font-bold">Failure Mode: </strong>
                                    <span>{ev.root_cause_analysis.primary_failure_mode}</span>
                                  </p>
                                )}
                                {ev.root_cause_analysis?.missed_authoritative_anchors?.length > 0 && (
                                  <div>
                                    <span className="text-rose-900 font-bold block mb-1">Missed Authoritative Anchors:</span>
                                    <div className="flex flex-wrap gap-1">
                                      {ev.root_cause_analysis.missed_authoritative_anchors.map((anc: string, aIdx: number) => (
                                        <span key={aIdx} className="rounded-md bg-white border border-rose-200 px-2 py-0.5 text-[10px] text-rose-800 font-medium">
                                          + {anc}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Topper Gold Booster Recommendations */}
                            {(() => {
                              const boosterLines = ev.remedial_blueprint?.topper_gold_booster_lines?.length
                                ? ev.remedial_blueprint.topper_gold_booster_lines
                                : (ev.examiner_recommendations && ev.examiner_recommendations.length > 0)
                                  ? ev.examiner_recommendations
                                  : [
                                      ev.remedial_blueprint?.phase_1_immediate_fix,
                                      ev.remedial_blueprint?.phase_2_body_overhaul,
                                      ev.remedial_blueprint?.phase_3_evidence_injection,
                                      ev.remedial_blueprint?.phase_4_conclusion_upgrade,
                                    ].filter(Boolean);

                              if (!boosterLines || boosterLines.length === 0) return null;

                              return (
                                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-xs text-emerald-950">
                                  <strong className="text-emerald-900 font-bold mb-1.5 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 inline shrink-0" />
                                    <span>Topper Gold Booster Recommendations:</span>
                                  </strong>
                                  <ol className="list-decimal pl-5 space-y-1.5 marker:text-emerald-700 marker:font-semibold">
                                    {boosterLines.map((line: any, lIdx: number) => (
                                      <li key={lIdx} className="leading-relaxed pl-1 text-emerald-950">
                                        {typeof line === "string" ? line : JSON.stringify(line)}
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              );
                            })()}

                            {/* 360 Pillars Mini Grid */}
                            {ev.pillars_360 && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                                {Object.entries(ev.pillars_360).map(([k, val]) => (
                                  <div key={k} className="rounded-lg bg-white border border-[#E2E6EE] px-2 py-1 text-[11px] flex items-center justify-between">
                                    <span className="text-[#647084] capitalize">{k.replace(/_/g, " ").slice(0, 16)}</span>
                                    <span className="font-bold text-[#1F314D]">{String(val)}%</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}

            {/* Modal Footer */}
            <div className="border-t border-[#E2E6EE] p-4 bg-[#F8FAFC] flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedAttempt(null)}
                className="rounded-xl border-[#E2E6EE] text-xs font-semibold px-4"
              >
                Close Report
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

