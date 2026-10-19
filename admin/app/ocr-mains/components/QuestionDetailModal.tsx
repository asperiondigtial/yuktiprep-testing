"use client";

import React, { useState } from "react";
import {
  X,
  Edit,
  CheckCircle,
  Image as ImageIcon,
  Clock,
  Calendar,
  Layers,
  Award,
  BookOpen,
  Copy,
  Check,
} from "lucide-react";
import { OcrQuestion, DiagramItem } from "../types";
import MathMarkdownRenderer from "./MathMarkdownRenderer";

interface QuestionDetailModalProps {
  question: OcrQuestion | null;
  onClose: () => void;
  onEdit?: (question: OcrQuestion) => void;
  onApprove?: (id?: string) => void;
  onOpenDiagramPicker?: (question: OcrQuestion) => void;
  onInspectDiagram?: (diag: DiagramItem) => void;
  isApproving?: boolean;
}

export default function QuestionDetailModal({
  question,
  onClose,
  onEdit,
  onApprove,
  onOpenDiagramPicker,
  onInspectDiagram,
  isApproving = false,
}: QuestionDetailModalProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const [activeLang, setActiveLang] = useState<"en" | "hi">("en");

  if (!question) return null;

  const getDiagramSrc = (diag: DiagramItem) => {
    return (
      diag.data_url ||
      (diag.image_url.startsWith("http")
        ? diag.image_url
        : `${process.env.NEXT_PUBLIC_OCR_API_URL || "http://localhost:8000"}${diag.image_url}`)
    );
  };

  const handleCopyText = () => {
    const textToCopy =
      activeLang === "hi" && question.text_hi
        ? question.text_hi
        : question.text_en;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const paperName = question.paper_name || question.papername;
  const paperYear = question.paper_year || question.paperyear;
  const timeLimit = question.time_limit || question.timelimit;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                {question.status === "APPROVED" ? "Approved Question" : "Saved Draft"}
              </span>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Question {question.question_number || "-"}
              </h3>
              {question.section && (
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium">
                  {question.section}
                </span>
              )}
              {question.marks && (
                <span className="text-xs px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-semibold flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  {question.marks} Marks
                </span>
              )}
            </div>

            {/* Exam / Paper Info Badge */}
            {paperName && (
              <div className="flex items-center gap-3 text-xs text-indigo-700 dark:text-indigo-300 pt-1 font-medium flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                  <strong>Exam / Paper:</strong> {paperName} {paperYear ? `(${paperYear})` : ""}
                </span>
                {timeLimit && (
                  <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                    <Clock className="w-3 h-3" /> {timeLimit}
                  </span>
                )}
                {question.subject_type && (
                  <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400 capitalize">
                    <Layers className="w-3 h-3" /> {question.subject_type.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action / Language Bar */}
        <div className="px-6 py-2.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50 flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 font-medium mr-1">Language:</span>
            <button
              type="button"
              onClick={() => setActiveLang("en")}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                activeLang === "en"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              English
            </button>
            {question.text_hi && (
              <button
                type="button"
                onClick={() => setActiveLang("hi")}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  activeLang === "hi"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                Hindi / Multilingual
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy Text"}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Main Question Text */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Question Statement
            </h4>
            <div className="p-4 rounded-xl bg-zinc-50/70 dark:bg-zinc-950/40 border border-zinc-200/80 dark:border-zinc-800/80 leading-relaxed text-sm text-zinc-900 dark:text-zinc-100">
              {activeLang === "en" ? (
                question.text_en ? (
                  <MathMarkdownRenderer content={question.text_en} />
                ) : (
                  <p className="text-zinc-400 italic text-xs">No English text available</p>
                )
              ) : question.text_hi ? (
                <MathMarkdownRenderer content={question.text_hi} />
              ) : (
                <p className="text-zinc-400 italic text-xs">No Hindi text available</p>
              )}
            </div>
          </div>

          {/* Bilingual Secondary View if both available */}
          {activeLang === "en" && question.text_hi && (
            <div className="space-y-1.5 pt-1">
              <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                Hindi / Regional Version
              </h4>
              <div className="p-3.5 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/50 border-l-4 border-l-amber-500 text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">
                <MathMarkdownRenderer content={question.text_hi} />
              </div>
            </div>
          )}

          {/* Formulas extracted */}
          {question.latex_formulas && question.latex_formulas.length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Extracted LaTeX Expressions ({question.latex_formulas.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {question.latex_formulas.map((form, fIdx) => (
                  <div
                    key={fIdx}
                    className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-mono"
                  >
                    <MathMarkdownRenderer content={`$$${form}$$`} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attached Diagrams */}
          {question.diagrams && question.diagrams.length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Attached Diagrams ({question.diagrams.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {question.diagrams.map((diag, dIdx) => (
                  <div
                    key={dIdx}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-950/50 flex flex-col sm:flex-row items-center gap-3"
                  >
                    <div
                      onClick={() => onInspectDiagram && onInspectDiagram(diag)}
                      className="h-28 w-36 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center p-1.5 cursor-pointer hover:opacity-90 transition shrink-0"
                    >
                      <img
                        src={getDiagramSrc(diag)}
                        alt={diag.title || "Diagram"}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        🖼️ {diag.title || "Cropped Diagram"}
                      </h5>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Page {diag.page_number} • {diag.width} × {diag.height} px
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        {onOpenDiagramPicker && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenDiagramPicker(question);
                            }}
                            className="text-xs text-sky-600 hover:underline font-medium"
                          >
                            Replace / Manage
                          </button>
                        )}
                        {onInspectDiagram && (
                          <>
                            <span className="text-zinc-300">•</span>
                            <button
                              type="button"
                              onClick={() => onInspectDiagram(diag)}
                              className="text-xs text-zinc-500 hover:underline"
                            >
                              Inspect Full Size
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subquestions */}
          {question.subquestions && question.subquestions.length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Subquestions ({question.subquestions.length})
              </h4>
              <div className="space-y-3 pl-3 border-l-2 border-sky-300 dark:border-sky-800">
                {question.subquestions.map((sq, sqIdx) => (
                  <div
                    key={sqIdx}
                    className="p-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800/80 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">
                        ({sq.subquestion_number})
                      </span>
                      {sq.marks && (
                        <span className="text-xs px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          {sq.marks} marks
                        </span>
                      )}
                    </div>
                    {sq.text_en && (
                      <div className="text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">
                        <MathMarkdownRenderer content={sq.text_en} />
                      </div>
                    )}
                    {sq.diagrams && sq.diagrams.length > 0 && (
                      <div className="pt-1">
                        <img
                          src={getDiagramSrc(sq.diagrams[0])}
                          alt="Subquestion diagram"
                          className="h-20 w-auto object-contain rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-zinc-500">
            {question.id ? `ID: ${question.id}` : "Unsaved question draft"}
          </div>

          <div className="flex items-center gap-2">
            {onOpenDiagramPicker && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDiagramPicker(question);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 transition border border-sky-200 dark:border-sky-800"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                {question.diagrams && question.diagrams.length > 0 ? "Diagrams" : "+ Diagram"}
              </button>
            )}

            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(question);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 transition"
              >
                <Edit className="w-3.5 h-3.5" />
                Edit Question
              </button>
            )}

            {onApprove && question.status !== "APPROVED" && (
              <button
                type="button"
                disabled={isApproving}
                onClick={() => {
                  onApprove(question.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                {isApproving ? "Approving..." : "Approve Question"}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
