"use client";

import React, { useState } from "react";
import { X, Save, Plus, Trash2, Eye, Edit3, Image as ImageIcon } from "lucide-react";
import { OcrQuestion, SubQuestion, DiagramItem, MAINS_PAPER_OPTIONS } from "../types";
import MathMarkdownRenderer from "./MathMarkdownRenderer";

interface QuestionEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: OcrQuestion | null;
  onSave: (updated: OcrQuestion) => void;
  onOpenDiagramPicker: (target: { type: "question" | "subquestion"; sqIndex?: number }) => void;
}

export default function QuestionEditModal({
  isOpen,
  onClose,
  question,
  onSave,
  onOpenDiagramPicker,
}: QuestionEditModalProps) {
  if (!isOpen || !question) return null;

  const [form, setForm] = useState<OcrQuestion>({
    ...question,
    text_en: question.text_en ?? "",
    text_hi: question.text_hi ?? "",
    latex_formulas: [...(question.latex_formulas || [])],
    diagrams: [...(question.diagrams || [])],
    subquestions: (question.subquestions || []).map((sq) => ({
      ...sq,
      text_en: sq.text_en ?? "",
      text_hi: sq.text_hi ?? "",
      latex_formulas: [...(sq.latex_formulas || [])],
      diagrams: [...(sq.diagrams || [])],
    })),
  });

  const [previewTab, setPreviewTab] = useState<"edit" | "preview" | "split">("split");
  const [activeLang, setActiveLang] = useState<"en" | "hi">("en");

  const handleSave = () => {
    onSave(form);
    onClose();
  };

  const addFormula = () => {
    const formula = prompt("Enter LaTeX Formula (e.g. \\int_{0}^{\\pi} \\sin(x) dx):");
    if (formula) {
      setForm((prev) => ({
        ...prev,
        latex_formulas: [...(prev.latex_formulas || []), formula.trim()],
      }));
    }
  };

  const removeFormula = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      latex_formulas: (prev.latex_formulas || []).filter((_, i) => i !== idx),
    }));
  };

  const addSubquestion = () => {
    const num = prompt("Enter subquestion label (e.g. 1(a), (i), (a)):");
    if (!num) return;
    const newSq: SubQuestion = {
      subquestion_number: num.trim(),
      text_en: "",
      marks: "2",
      latex_formulas: [],
      diagrams: [],
    };
    setForm((prev) => ({
      ...prev,
      subquestions: [...(prev.subquestions || []), newSq],
    }));
  };

  const removeSubquestion = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      subquestions: (prev.subquestions || []).filter((_, i) => i !== idx),
    }));
  };

  const updateSubquestion = (idx: number, patch: Partial<SubQuestion>) => {
    setForm((prev) => {
      const copy = [...(prev.subquestions || [])];
      copy[idx] = { ...copy[idx], ...patch };
      return { ...prev, subquestions: copy };
    });
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-5xl w-full flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60">
          <div className="flex items-center gap-2">
            <span className="text-xl">✏️</span>
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Edit Question {form.question_number || ""}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Edit mathematical text, LaTeX formulas, subquestions, and diagram attachments.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-200/80 dark:bg-zinc-800 p-0.5 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setPreviewTab("edit")}
                className={`px-2.5 py-1 rounded-md transition ${previewTab === "edit" ? "bg-white dark:bg-zinc-700 shadow-xs text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400"}`}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab("split")}
                className={`px-2.5 py-1 rounded-md transition ${previewTab === "split" ? "bg-white dark:bg-zinc-700 shadow-xs text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400"}`}
              >
                Split View
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab("preview")}
                className={`px-2.5 py-1 rounded-md transition ${previewTab === "preview" ? "bg-white dark:bg-zinc-700 shadow-xs text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400"}`}
              >
                Live Preview
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Metadata Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Paper Name
              </label>
              <select
                value={form.paper_name || form.papername || ""}
                onChange={(e) => setForm({ ...form, paper_name: e.target.value, papername: e.target.value })}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="">Select Paper</option>
                <optgroup label="Core GS Papers (1-5)">
                  {MAINS_PAPER_OPTIONS.slice(0, 5).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Optional Papers (6-21)">
                  {MAINS_PAPER_OPTIONS.slice(5).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Question No.
              </label>
              <input
                type="text"
                value={form.question_number || ""}
                onChange={(e) => setForm({ ...form, question_number: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                placeholder="e.g. 1, 2(a)"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Section / Part
              </label>
              <input
                type="text"
                value={form.section || ""}
                onChange={(e) => setForm({ ...form, section: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                placeholder="e.g. Section A"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Marks
              </label>
              <input
                type="text"
                value={form.marks || ""}
                onChange={(e) => setForm({ ...form, marks: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                placeholder="e.g. 5"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Subheading / Topic
              </label>
              <input
                type="text"
                value={form.subheading || ""}
                onChange={(e) => setForm({ ...form, subheading: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                placeholder="Optional instruction"
              />
            </div>
          </div>

          {/* Question Text Editor & Live Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Question Text
                </span>
                <div className="flex gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveLang("en")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${activeLang === "en" ? "bg-sky-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"}`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveLang("hi")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${activeLang === "hi" ? "bg-sky-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"}`}
                  >
                    Hindi / Multilingual
                  </button>
                </div>
              </div>
              <span className="text-[11px] text-zinc-400">
                Supports LaTeX math equations using <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">$formula$</code> or <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">$$equation$$</code>
              </span>
            </div>

            <div className={`grid gap-4 ${previewTab === "split" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
              {/* Editor input */}
              {(previewTab === "edit" || previewTab === "split") && (
                <div>
                  <textarea
                    rows={8}
                    value={(activeLang === "en" ? form.text_en : form.text_hi) || ""}
                    onChange={(e) => {
                      if (activeLang === "en") {
                        setForm({ ...form, text_en: e.target.value });
                      } else {
                        setForm({ ...form, text_hi: e.target.value });
                      }
                    }}
                    placeholder={`Type ${activeLang === "en" ? "English" : "Hindi / Multilingual"} question text and LaTeX...`}
                    className="w-full text-xs font-mono p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
              )}

              {/* KaTeX & Markdown Preview */}
              {(previewTab === "preview" || previewTab === "split") && (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/50 p-4 overflow-y-auto max-h-52">
                  <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Live KaTeX Preview
                  </div>
                  <MathMarkdownRenderer
                    content={activeLang === "en" ? form.text_en : form.text_hi || "*No text provided*"}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Attached Diagrams Section */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-950/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-sky-600" /> Attached Diagrams ({form.diagrams?.length || 0})
                </h4>
                <p className="text-[11px] text-zinc-500">
                  Manage diagrams, circuit diagrams, and figures attached to this question.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onOpenDiagramPicker({ type: "question" })}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                {form.diagrams && form.diagrams.length > 0 ? "Change / Manage Diagram" : "Attach Diagram"}
              </button>
            </div>

            {form.diagrams && form.diagrams.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                {form.diagrams.map((diag, dIdx) => (
                  <div
                    key={diag.id || dIdx}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 flex items-center gap-3"
                  >
                    <img
                      src={getDiagramSrc(diag)}
                      alt={diag.title || "Diagram"}
                      className="w-16 h-16 object-contain rounded bg-zinc-100 dark:bg-zinc-950 p-1 shrink-0 border border-zinc-200 dark:border-zinc-800"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {diag.title || "Diagram Figure"}
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Page {diag.page_number} • {diag.width}×{diag.height}px
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenDiagramPicker({ type: "question" })}
                          className="text-[11px] text-sky-600 hover:underline"
                        >
                          Replace
                        </button>
                        <span className="text-zinc-300">•</span>
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, diagrams: [] })}
                          className="text-[11px] text-rose-600 hover:underline"
                        >
                          Detach
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 italic">No diagrams currently attached to this question.</p>
            )}
          </div>

          {/* LaTeX Equations Box */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-950/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  LaTeX Formula Equations ({form.latex_formulas?.length || 0})
                </h4>
                <p className="text-[11px] text-zinc-500">
                  Independent mathematical formula blocks extracted from the paper.
                </p>
              </div>
              <button
                type="button"
                onClick={addFormula}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-700 bg-white dark:bg-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 rounded-lg border border-zinc-200 dark:border-zinc-700 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Formula
              </button>
            </div>

            {form.latex_formulas && form.latex_formulas.length > 0 ? (
              <div className="space-y-2">
                {form.latex_formulas.map((formula, fIdx) => (
                  <div
                    key={fIdx}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs"
                  >
                    <div className="flex-1 font-mono text-sky-700 dark:text-sky-300 truncate">
                      ${formula}$
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFormula(fIdx)}
                      className="p-1 text-zinc-400 hover:text-rose-600 transition"
                      title="Remove formula"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 italic">No standalone formulas registered.</p>
            )}
          </div>

          {/* Subquestions Section */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-950/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Subquestions ({form.subquestions?.length || 0})
                </h4>
                <p className="text-[11px] text-zinc-500">
                  Sub-parts (e.g. (a), (b), (i), (ii)) with independent text, marks, and diagrams.
                </p>
              </div>
              <button
                type="button"
                onClick={addSubquestion}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-700 bg-white dark:bg-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 rounded-lg border border-zinc-200 dark:border-zinc-700 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Subquestion
              </button>
            </div>

            {form.subquestions && form.subquestions.length > 0 ? (
              <div className="space-y-3">
                {form.subquestions.map((sq, sqIdx) => (
                  <div
                    key={sqIdx}
                    className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={sq.subquestion_number}
                          onChange={(e) => updateSubquestion(sqIdx, { subquestion_number: e.target.value })}
                          className="w-16 text-xs px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 font-semibold text-zinc-900 dark:text-zinc-100"
                          placeholder="(a)"
                        />
                        <input
                          type="text"
                          value={sq.marks || ""}
                          onChange={(e) => updateSubquestion(sqIdx, { marks: e.target.value })}
                          className="w-16 text-xs px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                          placeholder="Marks"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenDiagramPicker({ type: "subquestion", sqIndex: sqIdx })}
                          className="px-2 py-1 text-xs font-medium text-sky-700 bg-sky-50 dark:bg-sky-950/60 dark:text-sky-300 rounded border border-sky-200 dark:border-sky-800"
                        >
                          {sq.diagrams && sq.diagrams.length > 0 ? "Edit Diagram" : "+ Diagram"}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSubquestion(sqIdx)}
                          className="p-1 text-zinc-400 hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <textarea
                      rows={3}
                      value={sq.text_en || ""}
                      onChange={(e) => updateSubquestion(sqIdx, { text_en: e.target.value })}
                      placeholder="Subquestion English text & formulas..."
                      className="w-full text-xs font-mono p-2.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 leading-relaxed"
                    />

                    {sq.diagrams && sq.diagrams.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 p-2 rounded">
                        <span>🖼️ Attached: {sq.diagrams[0].title || "Diagram"}</span>
                        <button
                          type="button"
                          onClick={() => updateSubquestion(sqIdx, { diagrams: [] })}
                          className="text-rose-600 hover:underline text-[11px] ml-auto"
                        >
                          Detach
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 italic">No subquestions added.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-lg transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition shadow-sm"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
