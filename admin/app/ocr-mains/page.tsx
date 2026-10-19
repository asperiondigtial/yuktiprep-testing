"use client";

import React, { useState, useEffect } from "react";
import {
  ScanText,
  FileSpreadsheet,
  CheckCircle2,
  Bookmark,
  Sparkles,
} from "lucide-react";
import { OcrProcessResult, OcrQuestion, DiagramItem, SubQuestion } from "./types";
import OcrStudioTab from "./components/OcrStudioTab";
import SavedQuestionsTab from "./components/SavedQuestionsTab";
import ApproveQuestionsTab from "./components/ApproveQuestionsTab";
import DiagramPickerModal from "./components/DiagramPickerModal";
import QuestionEditModal from "./components/QuestionEditModal";
import DiagramModal from "./components/DiagramModal";

export default function OcrMainsPage() {
  const [activeTab, setActiveTab] = useState<"ocr" | "saved" | "approved">("ocr");

  // In-memory OCR studio state
  const [ocrResult, setOcrResult] = useState<OcrProcessResult | null>(null);
  const [savingToDb, setSavingToDb] = useState<boolean>(false);

  // Tab counts
  const [savedCount, setSavedCount] = useState<number>(0);
  const [approvedCount, setApprovedCount] = useState<number>(0);

  // Modals state
  const [inspectedDiagram, setInspectedDiagram] = useState<DiagramItem | null>(null);

  // Diagram picker modal state
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [pickerTarget, setPickerTarget] = useState<{
    type: "question" | "subquestion";
    qIndex?: number;
    sqIndex?: number;
    questionRecord?: OcrQuestion;
  } | null>(null);

  // Question edit modal state
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [editingQuestion, setEditingQuestion] = useState<OcrQuestion | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Fetch counts from database
  const fetchCounts = async () => {
    try {
      const ocrApiUrl = process.env.NEXT_PUBLIC_OCR_API_URL || "http://localhost:8000";
      const [resSaved, resApproved] = await Promise.all([
        fetch(`${ocrApiUrl}/api/ocr-mains/questions?status=SAVED&limit=1`),
        fetch(`${ocrApiUrl}/api/ocr-mains/questions?status=APPROVED&limit=1`),
      ]);
      if (resSaved.ok) {
        const data = await resSaved.json();
        setSavedCount(data.total || 0);
      }
      if (resApproved.ok) {
        const data = await resApproved.json();
        setApprovedCount(data.total || 0);
      }
    } catch (e) {
      console.warn("Failed to fetch counts from OCR API:", e);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

  // Save questions to backend DB via FastAPI
  const handleSaveQuestionsToDb = async (
    questions: OcrQuestion[],
    paperDetails?: {
      paperName?: string;
      paperYear?: number;
      timeLimit?: string;
      sourceFilename?: string;
    }
  ) => {
    setSavingToDb(true);
    try {
      const ocrApiUrl = process.env.NEXT_PUBLIC_OCR_API_URL || "http://localhost:8000";
      const payload = {
        questions: questions.map((q) => ({
          ...q,
          status: "SAVED",
          subject_type: q.subject_type || ocrResult?.subject_type || "formula_maths",
        })),
        paper_name: paperDetails?.paperName || ocrResult?.paper_name || ocrResult?.exam_title || "Mains Question Paper",
        paper_year: paperDetails?.paperYear || ocrResult?.paper_year || (new Date().getFullYear()),
        time_limit: paperDetails?.timeLimit || ocrResult?.time_limit || "3 hours",
        source_filename: paperDetails?.sourceFilename || ocrResult?.exam_title || "Question Paper",
        subject_type: ocrResult?.subject_type || "formula_maths",
      };

      const res = await fetch(`${ocrApiUrl}/api/ocr-mains/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Save failed" }));
        const errMsg = Array.isArray(err.detail)
          ? err.detail.map((e: any) => `${e.loc?.join(".") || "field"}: ${e.msg}`).join(", ")
          : (typeof err.detail === "string" ? err.detail : `Server error ${res.status}`);
        throw new Error(errMsg);
      }

      const resData = await res.json();
      alert(`Successfully saved ${resData.count || questions.length} questions to the database for paper "${payload.paper_name}"!`);
      fetchCounts();
    } catch (err: any) {
      alert("Error saving questions to DB: " + err.message);
    } finally {
      setSavingToDb(false);
    }
  };

  // Open Diagram Picker for an item in OCR studio or Saved list
  const handleOpenDiagramPicker = (target: {
    type: "question" | "subquestion";
    qIndex?: number;
    sqIndex?: number;
    questionRecord?: OcrQuestion;
  }) => {
    setPickerTarget(target);
    setPickerOpen(true);
  };

  // Upload custom diagram file to FastAPI
  const handleUploadCustomDiagram = async (file: File): Promise<DiagramItem | null> => {
    const ocrApiUrl = process.env.NEXT_PUBLIC_OCR_API_URL || "http://localhost:8000";
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${ocrApiUrl}/api/ocr-mains/diagrams/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Failed to upload diagram image");
    const data = await res.json();
    return data.diagram;
  };

  // Assign diagram from picker to the target
  const handleAssignDiagram = async (diag: DiagramItem) => {
    if (!pickerTarget) return;

    // Case 1: Editing a question that is already persisted in DB
    if (pickerTarget.questionRecord?.id) {
      const q = pickerTarget.questionRecord;
      const updatedDiags = [diag];
      try {
        const ocrApiUrl = process.env.NEXT_PUBLIC_OCR_API_URL || "http://localhost:8000";
        await fetch(`${ocrApiUrl}/api/ocr-mains/questions/${q.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...q, diagrams: updatedDiags }),
        });
        fetchCounts();
      } catch (e) {
        console.error(e);
      }
      return;
    }

    // Case 2: Editing an in-memory OCR studio question
    if (ocrResult && pickerTarget.qIndex !== undefined) {
      const copy = { ...ocrResult };
      const q = copy.questions[pickerTarget.qIndex];
      if (pickerTarget.type === "subquestion" && pickerTarget.sqIndex !== undefined && q.subquestions) {
        q.subquestions[pickerTarget.sqIndex].diagrams = [diag];
      } else {
        q.diagrams = [diag];
      }
      setOcrResult({ ...copy });
    }
  };

  // Detach diagram from target
  const handleDetachDiagram = async () => {
    if (!pickerTarget) return;

    if (pickerTarget.questionRecord?.id) {
      const q = pickerTarget.questionRecord;
      try {
        const ocrApiUrl = process.env.NEXT_PUBLIC_OCR_API_URL || "http://localhost:8000";
        await fetch(`${ocrApiUrl}/api/ocr-mains/questions/${q.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...q, diagrams: [] }),
        });
        fetchCounts();
      } catch (e) {
        console.error(e);
      }
      return;
    }

    if (ocrResult && pickerTarget.qIndex !== undefined) {
      const copy = { ...ocrResult };
      const q = copy.questions[pickerTarget.qIndex];
      if (pickerTarget.type === "subquestion" && pickerTarget.sqIndex !== undefined && q.subquestions) {
        q.subquestions[pickerTarget.sqIndex].diagrams = [];
      } else {
        q.diagrams = [];
      }
      setOcrResult({ ...copy });
    }
  };

  // Open Question Edit modal
  const handleOpenQuestionEdit = (q: OcrQuestion, index?: number) => {
    setEditingQuestion(q);
    setEditingIndex(index !== undefined ? index : null);
    setEditModalOpen(true);
  };

  // Save edited question
  const handleSaveQuestionChanges = async (updated: OcrQuestion) => {
    // If it has an existing DB ID, update via FastAPI
    if (updated.id) {
      try {
        const ocrApiUrl = process.env.NEXT_PUBLIC_OCR_API_URL || "http://localhost:8000";
        const res = await fetch(`${ocrApiUrl}/api/ocr-mains/questions/${updated.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
        if (!res.ok) throw new Error("Failed to update question in database");
        fetchCounts();
      } catch (err: any) {
        alert("Error updating question: " + err.message);
      }
      return;
    }

    // Otherwise update in-memory OCR studio result
    if (ocrResult && editingIndex !== null) {
      const copy = { ...ocrResult };
      copy.questions[editingIndex] = updated;
      setOcrResult({ ...copy });
    }
  };

  // Helper for picker label and current diagrams
  const getPickerContextDetails = () => {
    if (!pickerTarget) return { label: "Question", current: [] };

    if (pickerTarget.questionRecord) {
      return {
        label: `Question ${pickerTarget.questionRecord.question_number || ""}`,
        current: pickerTarget.questionRecord.diagrams || [],
      };
    }

    if (ocrResult && pickerTarget.qIndex !== undefined) {
      const q = ocrResult.questions[pickerTarget.qIndex];
      if (pickerTarget.type === "subquestion" && pickerTarget.sqIndex !== undefined && q?.subquestions) {
        const sq = q.subquestions[pickerTarget.sqIndex];
        return {
          label: `Q${q.question_number || pickerTarget.qIndex + 1} (${sq?.subquestion_number || pickerTarget.sqIndex + 1})`,
          current: sq?.diagrams || [],
        };
      }
      return {
        label: `Question ${q?.question_number || pickerTarget.qIndex + 1}`,
        current: q?.diagrams || [],
      };
    }

    return { label: "Question", current: [] };
  };

  const pickerDetails = getPickerContextDetails();

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50/60 dark:bg-zinc-950 p-6 md:p-8 space-y-6">
      {/* Page Title & Module Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-sm">
              <ScanText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                ocr-main's
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                  STEM Studio
                </span>
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Pix2Text LaTeX Formula Recognition • Auto Diagram Cropping • PostgreSQL Question Bank
              </p>
            </div>
          </div>
        </div>

        {/* 3 Main Tabs Nav Bar */}
        <div className="flex items-center bg-zinc-200/70 dark:bg-zinc-900 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("ocr")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === "ocr"
                ? "bg-white dark:bg-zinc-800 text-sky-700 dark:text-sky-300 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <Sparkles className="w-4 h-4 text-sky-500" />
            <span>1. ocr</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("saved");
              fetchCounts();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === "saved"
                ? "bg-white dark:bg-zinc-800 text-amber-700 dark:text-amber-300 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <Bookmark className="w-4 h-4 text-amber-500" />
            <span>2. saved question</span>
            {savedCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold">
                {savedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("approved");
              fetchCounts();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === "approved"
                ? "bg-white dark:bg-zinc-800 text-emerald-700 dark:text-emerald-300 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>3. approve question</span>
            {approvedCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold">
                {approvedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab 1: OCR Studio */}
      {activeTab === "ocr" && (
        <OcrStudioTab
          onOpenDiagramPicker={(target) => handleOpenDiagramPicker(target)}
          onOpenQuestionEdit={(q, idx) => handleOpenQuestionEdit(q, idx)}
          onInspectDiagram={(diag) => setInspectedDiagram(diag)}
          result={ocrResult}
          setResult={setOcrResult}
          onSaveQuestionsToDb={handleSaveQuestionsToDb}
          savingToDb={savingToDb}
        />
      )}

      {/* Tab 2: Saved Questions */}
      {activeTab === "saved" && (
        <SavedQuestionsTab
          onOpenQuestionEdit={(q) => handleOpenQuestionEdit(q)}
          onOpenDiagramPicker={(q) =>
            handleOpenDiagramPicker({ type: "question", questionRecord: q })
          }
          onInspectDiagram={(diag) => setInspectedDiagram(diag)}
          onQuestionApprovedOrUpdated={() => fetchCounts()}
        />
      )}

      {/* Tab 3: Approve Questions */}
      {activeTab === "approved" && (
        <ApproveQuestionsTab
          onOpenQuestionEdit={(q) => handleOpenQuestionEdit(q)}
          onOpenDiagramPicker={(q) =>
            handleOpenDiagramPicker({ type: "question", questionRecord: q })
          }
          onInspectDiagram={(diag) => setInspectedDiagram(diag)}
          onQuestionRevertedOrUpdated={() => fetchCounts()}
        />
      )}

      {/* Diagram Full Resolution Modal */}
      <DiagramModal
        diagram={inspectedDiagram}
        onClose={() => setInspectedDiagram(null)}
      />

      {/* Diagram Picker & Editor Modal */}
      <DiagramPickerModal
        isOpen={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setPickerTarget(null);
        }}
        targetLabel={pickerDetails.label}
        currentDiagrams={pickerDetails.current}
        availableDiagrams={ocrResult?.diagrams || []}
        onAssignDiagram={handleAssignDiagram}
        onDetachDiagram={handleDetachDiagram}
        onUploadCustomDiagram={handleUploadCustomDiagram}
        onInspectDiagram={(diag) => setInspectedDiagram(diag)}
      />

      {/* In-Depth Question Editor Modal */}
      <QuestionEditModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingQuestion(null);
          setEditingIndex(null);
        }}
        question={editingQuestion}
        onSave={handleSaveQuestionChanges}
        onOpenDiagramPicker={(target) => {
          if (editingIndex !== null) {
            handleOpenDiagramPicker({
              type: target.type,
              qIndex: editingIndex,
              sqIndex: target.sqIndex,
            });
          } else if (editingQuestion) {
            handleOpenDiagramPicker({
              type: target.type,
              questionRecord: editingQuestion,
            });
          }
        }}
      />
    </div>
  );
}
