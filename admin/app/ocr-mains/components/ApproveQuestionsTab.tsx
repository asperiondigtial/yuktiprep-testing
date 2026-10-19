"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  RefreshCw,
  CheckCircle2,
  Edit,
  Trash2,
  Image as ImageIcon,
  RotateCcw,
  Copy,
  Download,
  ExternalLink,
} from "lucide-react";
import { OcrQuestion, DiagramItem } from "../types";
import MathMarkdownRenderer from "./MathMarkdownRenderer";
import QuestionDetailModal from "./QuestionDetailModal";

interface ApproveQuestionsTabProps {
  onOpenQuestionEdit: (question: OcrQuestion) => void;
  onOpenDiagramPicker: (question: OcrQuestion) => void;
  onInspectDiagram: (diag: DiagramItem) => void;
  onQuestionRevertedOrUpdated: () => void;
}

export default function ApproveQuestionsTab({
  onOpenQuestionEdit,
  onOpenDiagramPicker,
  onInspectDiagram,
  onQuestionRevertedOrUpdated,
}: ApproveQuestionsTabProps) {
  const [questions, setQuestions] = useState<OcrQuestion[]>([]);
  const [papers, setPapers] = useState<{ id: string; paper_name: string; paper_year?: number; time_limit?: string; questions_count?: number }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [subjectFilter, setSubjectFilter] = useState<string>("");
  const [paperFilter, setPaperFilter] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [inspectQuestion, setInspectQuestion] = useState<OcrQuestion | null>(null);

  const fetchPapers = async () => {
    try {
      const ocrApiUrl = process.env.NEXT_PUBLIC_OCR_API_URL || "http://localhost:8000";
      const res = await fetch(`${ocrApiUrl}/api/ocr-mains/papers`);
      if (res.ok) {
        const data = await res.json();
        setPapers(data.papers || []);
      }
    } catch (e) {
      console.error("Failed to load papers:", e);
    }
  };

  const fetchApprovedQuestions = async () => {
    setLoading(true);
    try {
      const ocrApiUrl = process.env.NEXT_PUBLIC_OCR_API_URL || "http://localhost:8000";
      const params = new URLSearchParams({ status: "APPROVED" });
      if (subjectFilter) params.append("subject_type", subjectFilter);
      if (paperFilter) params.append("paper_id", paperFilter);
      if (search.trim()) params.append("search", search.trim());

      const res = await fetch(`${ocrApiUrl}/api/ocr-mains/questions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load approved questions");
      const data = await res.json();
      setQuestions(data.items || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPapers();
  }, []);

  useEffect(() => {
    fetchApprovedQuestions();
  }, [subjectFilter, paperFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchApprovedQuestions();
  };

  const handleRevertToSaved = async (id?: string) => {
    if (!id || !confirm("Revert this approved question back to Saved Drafts?")) return;
    setActionLoading(id);
    try {
      const ocrApiUrl = process.env.NEXT_PUBLIC_OCR_API_URL || "http://localhost:8000";
      const res = await fetch(`${ocrApiUrl}/api/ocr-mains/questions/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SAVED" }),
      });
      if (!res.ok) throw new Error("Failed to revert question status");
      fetchApprovedQuestions();
      onQuestionRevertedOrUpdated();
    } catch (err: any) {
      alert("Error reverting question: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id || !confirm("Are you sure you want to permanently delete this approved question?")) return;
    try {
      const ocrApiUrl = process.env.NEXT_PUBLIC_OCR_API_URL || "http://localhost:8000";
      const res = await fetch(`${ocrApiUrl}/api/ocr-mains/questions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete question");
      fetchApprovedQuestions();
    } catch (err: any) {
      alert("Error deleting question: " + err.message);
    }
  };

  const copyAsMarkdown = (q: OcrQuestion) => {
    let md = `## Question ${q.question_number || ""}\n\n${q.text_en || ""}\n`;
    if (q.subquestions && q.subquestions.length > 0) {
      md += "\n### Subquestions:\n";
      q.subquestions.forEach((sq) => {
        md += `- **(${sq.subquestion_number})**: ${sq.text_en || ""}\n`;
      });
    }
    navigator.clipboard.writeText(md);
    alert("Copied question markdown & LaTeX to clipboard!");
  };

  const getDiagramSrc = (diag: DiagramItem) => {
    return (
      diag.data_url ||
      (diag.image_url.startsWith("http")
        ? diag.image_url
        : `${process.env.NEXT_PUBLIC_OCR_API_URL || "http://localhost:8000"}${diag.image_url}`)
    );
  };

  return (
    <div className="space-y-5">
      {/* Top filter toolbar */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search approved questions, formulas, or numbers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 transition shrink-0"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={paperFilter}
            onChange={(e) => setPaperFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 max-w-[200px] truncate"
            title="Filter by Question Paper"
          >
            <option value="">All Question Papers</option>
            {papers.map((p) => (
              <option key={p.id} value={p.id}>
                📑 {p.paper_name} {p.paper_year ? `(${p.paper_year})` : ""} - ⏱️ {p.time_limit || "3 hrs"}
              </option>
            ))}
          </select>

          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          >
            <option value="">All Subjects</option>
            <option value="formula_maths">Mathematics</option>
            <option value="physics">Physics</option>
            <option value="chemistry">Chemistry</option>
            <option value="general">General</option>
          </select>

          <button
            type="button"
            onClick={fetchApprovedQuestions}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 transition"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Approved Questions List */}
      {loading ? (
        <div className="p-12 text-center text-zinc-400 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs font-medium">Loading approved questions...</p>
        </div>
      ) : questions.length === 0 ? (
        <div className="p-16 text-center text-zinc-400 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center">
          <span className="text-4xl mb-2">✅</span>
          <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            No Approved Questions Found
          </h4>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm">
            Questions approved in the "Saved Question" tab will appear here. All approved questions
            remain editable with diagrams and formulas intact.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-zinc-500 px-2 flex items-center justify-between">
            <span>
              Showing <strong>{questions.length}</strong> approved questions in the platform bank
            </span>
            <span>All approved questions and attached diagrams remain fully editable</span>
          </div>

          {questions.map((q) => {
            const paperTitle = q.paper_name || q.papername || "Mains Examination Paper";
            const paperYr = q.paper_year || q.paperyear;
            const paperTime = q.time_limit || q.timelimit || "3 hours";

            return (
              <div
                key={q.id}
                className="group rounded-2xl border border-emerald-500/30 bg-white dark:bg-zinc-900 shadow-xs space-y-0 relative overflow-hidden"
              >
                {/* Subtle top indicator bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>

                {/* Exam Title Header Banner */}
                <div className="px-5 py-3 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-transparent dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-transparent border-b border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-600 text-white dark:bg-emerald-500 shrink-0">
                      Exam
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {paperTitle}
                    </h4>
                    {paperYr && (
                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        ({paperYr})
                      </span>
                    )}
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 shrink-0">
                      ⏱️ {paperTime}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3 h-3" /> Approved
                    </span>
                    <button
                      type="button"
                      onClick={() => setInspectQuestion(q)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition"
                      title="Open full question dialog"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>View Dialog</span>
                    </button>
                  </div>
                </div>

                {/* Card Body Container */}
                <div className="p-5 space-y-4">
                  {/* Card Sub-Header */}
                  <div className="flex items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                        Question {q.question_number || "-"}
                      </span>
                      {q.section && (
                        <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium">
                          {q.section}
                        </span>
                      )}
                      {q.marks && (
                        <span className="text-xs px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-medium">
                          {q.marks} Marks
                        </span>
                      )}
                      {q.source_filename && (
                        <span className="text-[11px] text-zinc-400 truncate max-w-[150px]">
                          📁 {q.source_filename}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyAsMarkdown(q)}
                        className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                        title="Copy Markdown & LaTeX"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenDiagramPicker(q)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 transition border border-sky-200 dark:border-sky-800"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        {q.diagrams && q.diagrams.length > 0 ? "Edit Diagram" : "+ Diagram"}
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenQuestionEdit(q)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 transition"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Edit
                      </button>

                      <button
                        type="button"
                        disabled={actionLoading === q.id}
                        onClick={() => handleRevertToSaved(q.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 transition border border-amber-200 dark:border-amber-800"
                        title="Revert question to Saved state"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Revert
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(q.id)}
                        className="p-1.5 text-zinc-400 hover:text-rose-600 transition"
                        title="Delete question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Question Text with KaTeX formulas - clickable to open dialog */}
                  <div
                    onClick={() => setInspectQuestion(q)}
                    className="cursor-pointer group-hover:bg-zinc-50/50 dark:group-hover:bg-zinc-950/30 p-2.5 -m-2.5 rounded-xl transition"
                    title="Click question to open full dialog"
                  >
                    {q.text_en && (
                      <div className="text-sm">
                        <MathMarkdownRenderer content={q.text_en} />
                      </div>
                    )}

                    {/* Multilingual Text */}
                    {q.text_hi && (
                      <div className="text-sm text-zinc-700 dark:text-zinc-300 border-l-2 border-emerald-400 pl-3 mt-3">
                        <MathMarkdownRenderer content={q.text_hi} />
                      </div>
                    )}
                  </div>

                  {/* Diagrams */}
                  {q.diagrams && q.diagrams.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {q.diagrams.map((diag, dIdx) => (
                        <div
                          key={dIdx}
                          className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-950/50 flex flex-col sm:flex-row items-center gap-4"
                        >
                          <div
                            onClick={() => onInspectDiagram(diag)}
                            className="h-28 w-44 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center p-1.5 cursor-pointer hover:opacity-90 transition shrink-0"
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
                              <button
                                type="button"
                                onClick={() => onOpenDiagramPicker(q)}
                                className="text-xs text-sky-600 hover:underline font-medium"
                              >
                                Replace / Manage
                              </button>
                              <span className="text-zinc-300">•</span>
                              <button
                                type="button"
                                onClick={() => onInspectDiagram(diag)}
                                className="text-xs text-zinc-500 hover:underline"
                              >
                                Inspect Full Size
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Subquestions */}
                  {q.subquestions && q.subquestions.length > 0 && (
                    <div className="space-y-2 pl-3 border-l-2 border-emerald-300 dark:border-emerald-800 pt-1">
                      {q.subquestions.map((sq, sqIdx) => (
                        <div
                          key={sqIdx}
                          onClick={() => setInspectQuestion(q)}
                          className="text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100"
                        >
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            ({sq.subquestion_number})
                          </span>{" "}
                          <MathMarkdownRenderer content={sq.text_en || ""} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Question Details Full Dialog */}
      <QuestionDetailModal
        question={inspectQuestion}
        onClose={() => setInspectQuestion(null)}
        onEdit={(q) => onOpenQuestionEdit(q)}
        onOpenDiagramPicker={(q) => onOpenDiagramPicker(q)}
        onInspectDiagram={(diag) => onInspectDiagram(diag)}
      />
    </div>
  );
}
