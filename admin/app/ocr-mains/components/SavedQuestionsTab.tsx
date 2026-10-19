"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  RefreshCw,
  CheckCircle,
  Edit,
  Trash2,
  Image as ImageIcon,
  CheckSquare,
  Square,
  Filter,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { OcrQuestion, DiagramItem, MAINS_PAPER_OPTIONS } from "../types";
import MathMarkdownRenderer from "./MathMarkdownRenderer";
import QuestionDetailModal from "./QuestionDetailModal";

interface SavedQuestionsTabProps {
  onOpenQuestionEdit: (question: OcrQuestion) => void;
  onOpenDiagramPicker: (question: OcrQuestion) => void;
  onInspectDiagram: (diag: DiagramItem) => void;
  onQuestionApprovedOrUpdated: () => void;
}

export default function SavedQuestionsTab({
  onOpenQuestionEdit,
  onOpenDiagramPicker,
  onInspectDiagram,
  onQuestionApprovedOrUpdated,
}: SavedQuestionsTabProps) {
  const [questions, setQuestions] = useState<OcrQuestion[]>([]);
  const [papers, setPapers] = useState<{ id: string; paper_name: string; paper_year?: number; time_limit?: string; questions_count?: number }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [subjectFilter, setSubjectFilter] = useState<string>("");
  const [paperFilter, setPaperFilter] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  const fetchSavedQuestions = async () => {
    setLoading(true);
    try {
      const ocrApiUrl = process.env.NEXT_PUBLIC_OCR_API_URL || "http://localhost:8000";
      const params = new URLSearchParams({ status: "SAVED" });
      if (subjectFilter) params.append("subject_type", subjectFilter);
      if (paperFilter) params.append("paper_id", paperFilter);
      if (search.trim()) params.append("search", search.trim());

      const res = await fetch(`${ocrApiUrl}/api/ocr-mains/questions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load saved questions");
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
    fetchSavedQuestions();
  }, [subjectFilter, paperFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSavedQuestions();
  };

  const handleApprove = async (id?: string) => {
    if (!id) return;
    setActionLoading(id);
    try {
      const ocrApiUrl = process.env.NEXT_PUBLIC_OCR_API_URL || "http://localhost:8000";
      const res = await fetch(`${ocrApiUrl}/api/ocr-mains/questions/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });
      if (!res.ok) throw new Error("Failed to approve question");
      fetchSavedQuestions();
      onQuestionApprovedOrUpdated();
    } catch (err: any) {
      alert("Error approving question: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    setActionLoading("batch");
    try {
      const ocrApiUrl = process.env.NEXT_PUBLIC_OCR_API_URL || "http://localhost:8000";
      const res = await fetch(`${ocrApiUrl}/api/ocr-mains/questions/batch-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (!res.ok) throw new Error("Batch approve failed");
      setSelectedIds([]);
      fetchSavedQuestions();
      onQuestionApprovedOrUpdated();
    } catch (err: any) {
      alert("Error in batch approval: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id || !confirm("Are you sure you want to delete this saved question?")) return;
    try {
      const ocrApiUrl = process.env.NEXT_PUBLIC_OCR_API_URL || "http://localhost:8000";
      const res = await fetch(`${ocrApiUrl}/api/ocr-mains/questions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete question");
      fetchSavedQuestions();
    } catch (err: any) {
      alert("Error deleting question: " + err.message);
    }
  };

  const toggleSelect = (id?: string) => {
    if (!id) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const [inspectQuestion, setInspectQuestion] = useState<OcrQuestion | null>(null);

  const toggleSelectAll = () => {
    if (selectedIds.length === questions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(questions.map((q) => q.id!).filter(Boolean));
    }
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
      {/* Search & Filter Toolbar */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search saved questions, formulas, or question numbers..."
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
            onClick={fetchSavedQuestions}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 transition"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {selectedIds.length > 0 && (
            <button
              type="button"
              disabled={actionLoading === "batch"}
              onClick={handleBatchApprove}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Approve ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Questions List */}
      {loading ? (
        <div className="p-12 text-center text-zinc-400 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs font-medium">Loading saved questions from database...</p>
        </div>
      ) : questions.length === 0 ? (
        <div className="p-16 text-center text-zinc-400 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center">
          <span className="text-4xl mb-2">💾</span>
          <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            No Saved Questions Found
          </h4>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm">
            Questions extracted in the "OCR" tab will appear here once saved. You can review,
            edit formulas/diagrams, and approve them for testing.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header Select All Bar */}
          <div className="flex items-center justify-between px-2 text-xs text-zinc-500">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-1.5 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
            >
              {selectedIds.length === questions.length ? (
                <CheckSquare className="w-4 h-4 text-sky-600" />
              ) : (
                <Square className="w-4 h-4 text-zinc-400" />
              )}
              Select All ({questions.length} saved)
            </button>
            <span>Click any question to view full details in a dialog or edit</span>
          </div>

          {questions.map((q) => {
            const isSelected = selectedIds.includes(q.id!);
            const paperTitle = q.paper_name || q.papername || "Mains Examination Paper";
            const paperYr = q.paper_year || q.paperyear;
            const paperTime = q.time_limit || q.timelimit || "3 hours";

            return (
              <div
                key={q.id}
                className={`group rounded-2xl border transition bg-white dark:bg-zinc-900 shadow-xs overflow-hidden ${
                  isSelected
                    ? "border-sky-500 ring-2 ring-sky-500/10"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                {/* Exam Title Header Banner */}
                <div className="px-5 py-3 bg-gradient-to-r from-indigo-50/80 via-sky-50/50 to-transparent dark:from-indigo-950/40 dark:via-sky-950/20 dark:to-transparent border-b border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(q.id);
                      }}
                      className="text-zinc-400 hover:text-sky-600 shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-sky-600" />
                      ) : (
                        <Square className="w-4 h-4 text-zinc-400" />
                      )}
                    </button>

                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-600 text-white dark:bg-indigo-500 shrink-0">
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
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      Saved Draft
                    </span>
                    <button
                      type="button"
                      onClick={() => setInspectQuestion(q)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 transition"
                      title="Open full question dialog"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>View Dialog</span>
                    </button>
                  </div>
                </div>

                {/* Question Card Content */}
                <div className="p-5 space-y-4">
                  {/* Question Meta & Quick Actions */}
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

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
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
                        onClick={() => handleApprove(q.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs disabled:opacity-50"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {actionLoading === q.id ? "Approving..." : "Approve"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(q.id)}
                        className="p-1.5 text-zinc-400 hover:text-rose-600 transition"
                        title="Delete saved question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Question Body - clickable to open dialog */}
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
                      <div className="text-sm text-zinc-700 dark:text-zinc-300 border-l-2 border-amber-400 pl-3 mt-3">
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
                    <div className="space-y-2 pl-3 border-l-2 border-sky-200 dark:border-sky-800 pt-1">
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
        onApprove={(id) => handleApprove(id)}
        onOpenDiagramPicker={(q) => onOpenDiagramPicker(q)}
        onInspectDiagram={(diag) => onInspectDiagram(diag)}
        isApproving={Boolean(inspectQuestion?.id && actionLoading === inspectQuestion.id)}
      />
    </div>
  );
}
