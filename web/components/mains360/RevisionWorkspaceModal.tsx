"use client";

import React, { useState } from "react";
import { X, Sparkles, CheckCircle2, TrendingUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OcrMainsQuestionItem, EvaluationResult } from "@/types/mains360";

interface RevisionWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeQuestion: OcrMainsQuestionItem;
  v1Text: string;
  v1Evaluation?: EvaluationResult | null;
  onSaveRevision: (revisedText: string, revisionEvaluation: any) => void;
}

export function RevisionWorkspaceModal({
  isOpen,
  onClose,
  activeQuestion,
  v1Text,
  v1Evaluation,
  onSaveRevision,
}: RevisionWorkspaceModalProps) {
  const [revisedText, setRevisedText] = useState(v1Text || "");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [deltaResult, setDeltaResult] = useState<any>(null);

  if (!isOpen) return null;

  const handleMeasureDelta = () => {
    setIsEvaluating(true);
    setTimeout(() => {
      // Simulate delta leap calculation
      const wordCount = revisedText.trim().split(/\s+/).filter(Boolean).length;
      const jump = "+2.5 Marks";
      const leapPct = "+32%";
      setDeltaResult({
        overall_verdict: "Significant Dialectical & Substantive Leap (+2.5 Marks)",
        mark_jump: jump,
        mark_jump_pct: leapPct,
        risk_reduction_pct: "-40% Penalty Risk",
        percentile_shift: "Shifted from 65th to 88th Percentile Band",
        newly_added_citations: [
          "2nd Administrative Reforms Commission (ARC)",
          "Article 14 & Article 21 Due Process Doctrine",
          "SDG Goal 16 Institutional Accountability",
        ],
        awarded_marks: 7.5,
        max_marks: activeQuestion.marks ? parseInt(activeQuestion.marks) : 10,
        overall_360_index: 82,
      });
      setIsEvaluating(false);
    }, 700);
  };

  const handleApply = () => {
    onSaveRevision(revisedText, deltaResult);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white p-6 md:p-8 shadow-2xl border border-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E6EE] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#1F314D]">
                UPSC 360° Board Revision Studio (Draft v1 → v2 Rewrite)
              </h3>
              <p className="text-xs text-[#647084]">
                Eliminate cognitive blindspots, inject authoritative case laws, and measure your delta mark jump
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Question Prompt */}
        <div className="mt-4 rounded-2xl border border-l-4 border-l-amber-500 border-[#E2E6EE] bg-[#F8FAFC] p-4">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              {activeQuestion.section || "Section A"}
            </span>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
              {activeQuestion.marks || "10"} Marks
            </span>
          </div>
          <p className="text-sm font-semibold text-[#1F314D] leading-snug">
            {activeQuestion.text_en}
          </p>
        </div>

        {/* Split Screen Workspace */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left Column: Draft v1 & Identified Gaps */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#647084]">
                1. Original Submission (Draft v1)
              </span>
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
                Score: {v1Evaluation?.awarded_marks || "4.5"} / {activeQuestion.marks || "10"}M
              </span>
            </div>

            <div className="rounded-2xl border border-[#E2E6EE] bg-neutral-50 p-3.5 text-xs text-neutral-700 max-h-[180px] overflow-y-auto whitespace-pre-line leading-relaxed">
              {v1Text || "No previous text entered."}
            </div>

            {/* Penalties & Gaps */}
            <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-3.5">
              <h5 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5 mb-2">
                <AlertTriangle className="h-4 w-4" />
                <span>Critical Penalties & Blindspots to Fix:</span>
              </h5>
              <ul className="text-xs text-[#1F314D] space-y-1 pl-4 list-disc">
                <li>Omission of statutory & institutional precedents (e.g., 2nd ARC, Punchhi).</li>
                <li>Lacks balanced counter-perspective before synthesizing conclusion.</li>
                <li>Single-dimensional focus on administrative issues without socioeconomic angles.</li>
              </ul>
            </div>
          </div>

          {/* Right Column: Draft v2 Rewrite Editor */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
                2. Revised Answer (Draft v2 Rewrite)
              </span>
              <span className="text-xs text-[#647084]">
                Words: {revisedText.trim().split(/\s+/).filter(Boolean).length}
              </span>
            </div>

            <textarea
              className="w-full flex-1 min-h-[220px] rounded-2xl border border-[#E2E6EE] bg-white p-3.5 text-xs md:text-sm leading-relaxed text-[#1F314D] focus:border-[#0F7F8C] focus:outline-none focus:ring-1 focus:ring-[#0F7F8C]"
              value={revisedText}
              onChange={(e) => setRevisedText(e.target.value)}
              placeholder="Refine and structure your answer with sub-headings, authoritative citations, and balanced conclusions..."
            />

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleMeasureDelta}
                disabled={isEvaluating || !revisedText.trim()}
                className="rounded-xl bg-[#0F7F8C] hover:bg-[#0c6b76] text-white text-xs font-semibold"
              >
                <Sparkles className="mr-2 h-4 w-4 text-amber-300" />
                <span>{isEvaluating ? "Measuring 360° Delta..." : "Measure Delta Score Jump"}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Delta Analysis Panel */}
        {deltaResult && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <h4 className="text-sm font-bold text-emerald-800">
                  {deltaResult.overall_verdict}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                  Score: {deltaResult.awarded_marks} / {deltaResult.max_marks}M
                </span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  Quality Index: {deltaResult.overall_360_index}/100
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl bg-white p-2.5 border border-emerald-100 shadow-xs">
                <div className="text-[10px] text-[#647084]">Mark Jump</div>
                <div className="text-base font-extrabold text-emerald-700">{deltaResult.mark_jump}</div>
              </div>
              <div className="rounded-xl bg-white p-2.5 border border-emerald-100 shadow-xs">
                <div className="text-[10px] text-[#647084]">Score Leap %</div>
                <div className="text-base font-extrabold text-emerald-700">{deltaResult.mark_jump_pct}</div>
              </div>
              <div className="rounded-xl bg-white p-2.5 border border-emerald-100 shadow-xs">
                <div className="text-[10px] text-[#647084]">Risk Reduction</div>
                <div className="text-base font-extrabold text-indigo-700">{deltaResult.risk_reduction_pct}</div>
              </div>
              <div className="rounded-xl bg-white p-2.5 border border-emerald-100 shadow-xs">
                <div className="text-[10px] text-[#647084]">Percentile Shift</div>
                <div className="text-xs font-bold text-neutral-800 mt-1">{deltaResult.percentile_shift}</div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between border-t border-[#E2E6EE] pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl border-[#E2E6EE] text-xs font-medium text-[#1F314D]"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleApply}
            disabled={!deltaResult}
            className="rounded-xl bg-[#233249] hover:bg-[#1a2536] text-white text-xs font-semibold"
          >
            <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" />
            <span>Apply Draft v2 to Studio</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
