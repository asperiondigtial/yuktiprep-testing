"use client";

import React, { useState } from "react";
import {
  Upload,
  FileText,
  Sparkles,
  Layers,
  Image as ImageIcon,
  CheckCircle2,
  Copy,
  Download,
  Edit,
  Trash2,
  Key,
  ExternalLink,
  Save,
  Search,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { OcrProcessResult, OcrQuestion, DiagramItem, MAINS_PAPER_OPTIONS } from "../types";
import MathMarkdownRenderer from "./MathMarkdownRenderer";
import QuestionDetailModal from "./QuestionDetailModal";
import { getOcrApiUrl } from "../utils/ocrConfig";

interface OcrStudioTabProps {
  onOpenDiagramPicker: (target: { type: "question" | "subquestion"; qIndex: number; sqIndex?: number }) => void;
  onOpenQuestionEdit: (question: OcrQuestion, index: number) => void;
  onInspectDiagram: (diag: DiagramItem) => void;
  result: OcrProcessResult | null;
  setResult: React.Dispatch<React.SetStateAction<OcrProcessResult | null>>;
  onSaveQuestionsToDb: (
    questions: OcrQuestion[],
    paperDetails?: {
      paperName?: string;
      paperYear?: number;
      timeLimit?: string;
      sourceFilename?: string;
    }
  ) => Promise<void>;
  savingToDb: boolean;
}

export default function OcrStudioTab({
  onOpenDiagramPicker,
  onOpenQuestionEdit,
  onInspectDiagram,
  result,
  setResult,
  onSaveQuestionsToDb,
  savingToDb,
}: OcrStudioTabProps) {
  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [paperName, setPaperName] = useState<string>("General Studies I (GS-I)");
  const [paperYear, setPaperYear] = useState<string>(new Date().getFullYear().toString());
  const [timeLimit, setTimeLimit] = useState<string>("3 hours");
  const [subjectType, setSubjectType] = useState<string>("formula_maths");
  const [languages, setLanguages] = useState<string>("eng+hin");
  const [dpi, setDpi] = useState<number>(300);
  const [startPage, setStartPage] = useState<string>("");
  const [endPage, setEndPage] = useState<string>("");
  const [processing, setProcessing] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<"questions" | "diagrams" | "raw">("questions");

  // Question paper details modal prompted on file upload
  const [showUploadPromptModal, setShowUploadPromptModal] = useState<boolean>(false);
  const [inspectQuestion, setInspectQuestion] = useState<OcrQuestion | null>(null);

  // Gemini API Key modal
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [geminiKey, setGeminiKey] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("gemini_api_key") || "";
    }
    return "";
  });
  const [geminiModel, setGeminiModel] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("gemini_model") || "gemini-1.5-flash-8b";
    }
    return "gemini-1.5-flash-8b";
  });

  const saveGeminiKey = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("gemini_api_key", geminiKey.trim());
      localStorage.setItem("gemini_model", geminiModel);
    }
    setShowKeyModal(false);
  };

  const handleSelectFile = (file: File) => {
    setSelectedFile(file);
    const fname = file.name.toLowerCase();

    // Check if filename matches any of the 21 UPSC papers
    const matched = MAINS_PAPER_OPTIONS.find((opt) => {
      const lowerOpt = opt.toLowerCase();
      if (lowerOpt.includes("gs-i") && fname.includes("gs-1") || fname.includes("gs1") || fname.includes("gs-i")) return true;
      if (lowerOpt.includes("gs-ii") && fname.includes("gs-2") || fname.includes("gs2") || fname.includes("gs-ii")) return true;
      if (lowerOpt.includes("gs-iii") && fname.includes("gs-3") || fname.includes("gs3") || fname.includes("gs-iii")) return true;
      if (lowerOpt.includes("gs-iv") && fname.includes("gs-4") || fname.includes("gs4") || fname.includes("gs-iv")) return true;
      if (lowerOpt.includes("essay") && fname.includes("essay")) return true;
      const pureName = opt.replace(/^Optional\s*–\s*/i, "").toLowerCase();
      return fname.includes(pureName);
    });

    if (matched) {
      setPaperName(matched);
    }

    const yearMatch = file.name.match(/\b(19\d\d|20\d\d)\b/);
    if (yearMatch && yearMatch[1]) {
      setPaperYear(yearMatch[1]);
    } else {
      setPaperYear(new Date().getFullYear().toString());
    }
    if (!timeLimit) {
      setTimeLimit("3 hours");
    }
    // Ask for paper details immediately upon file upload
    setShowUploadPromptModal(true);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectFile(e.dataTransfer.files[0]);
    }
  };

  const executeProcess = async (
    targetFile: File,
    overridePaperName?: string,
    overridePaperYear?: string,
    overrideTimeLimit?: string,
    overrideSubjectType?: string
  ) => {
    setProcessing(true);
    const pName = overridePaperName || paperName || targetFile.name.replace(/\.[^/.]+$/, "");
    const pYear = overridePaperYear !== undefined ? overridePaperYear : paperYear;
    const tLimit = overrideTimeLimit || timeLimit || "3 hours";
    const sType = overrideSubjectType || subjectType;

    const formData = new FormData();
    formData.append("file", targetFile);
    formData.append("paper_name", pName);
    if (pYear) formData.append("paper_year", pYear);
    formData.append("time_limit", tLimit);
    formData.append("subject_type", sType);
    formData.append("languages", languages);
    formData.append("dpi", dpi.toString());
    if (startPage) formData.append("start_page", startPage);
    if (endPage) formData.append("end_page", endPage);
    if (geminiKey) formData.append("api_key", geminiKey);
    formData.append("model", geminiModel);

    try {
      const ocrApiUrl = getOcrApiUrl();
      console.log(`[OCR] Uploading to: ${ocrApiUrl}/api/ocr/subject-process`);
      const res = await fetch(`${ocrApiUrl}/api/ocr/subject-process`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "OCR processing failed" }));
        throw new Error(err.detail || `Server error ${res.status}`);
      }

      const data: OcrProcessResult = await res.json();
      setResult(data);
    } catch (err: any) {
      console.error("[OCR] Processing error:", err);
      alert("Error extracting question paper: " + (err.message || String(err)));
    } finally {
      setProcessing(false);
    }
  };

  const handleProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    await executeProcess(selectedFile);
  };

  const handleConfirmModalAndExtract = async () => {
    if (!selectedFile) return;
    if (!paperName.trim()) {
      alert("Please specify a Paper Name.");
      return;
    }
    setShowUploadPromptModal(false);
    await executeProcess(selectedFile, paperName, paperYear, timeLimit, subjectType);
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
    <div className="space-y-6">
      {/* Top Banner & Key configuration */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-transparent p-4 rounded-2xl border border-sky-500/20 dark:border-sky-500/10">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>📐</span> STEM Question Paper Extraction Studio
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Powered by <strong>Pix2Text</strong> (LaTeX formulas), <strong>pdftoppm</strong>, and <strong>Automatic Diagram Cropper</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowKeyModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition shadow-xs"
          >
            <Key className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
              {geminiKey ? "Custom Gemini Key" : "✓ Server Env Key Active"}
            </span>
          </button>
        </div>
      </div>

      {/* Main Grid: Upload Controls & Results View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Upload & Setup) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-sky-600" /> Upload Question Paper
            </h3>

            {/* Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className={`border-2 border-dashed rounded-xl p-5 text-center transition cursor-pointer ${selectedFile
                  ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20"
                  : "border-zinc-300 dark:border-zinc-700 hover:border-sky-500 bg-zinc-50/50 dark:bg-zinc-950/40"
                }`}
            >
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp,image/tiff"
                  onChange={(e) => e.target.files && handleSelectFile(e.target.files[0])}
                  className="hidden"
                />
                {selectedFile ? (
                  <div className="space-y-1">
                    <span className="text-2xl">📄</span>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click to change
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="w-10 h-10 mx-auto rounded-full bg-sky-100 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                      Drag & drop PDF / Image paper
                    </p>
                    <p className="text-[11px] text-zinc-400">or click to browse files</p>
                  </div>
                )}
              </label>
            </div>

            {/* Mains Question Paper Details (Required for Mains Bank) */}
            <div className="rounded-xl border border-sky-200 dark:border-sky-800/80 bg-sky-50/50 dark:bg-sky-950/20 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                  <span>📑</span> Question Paper Details
                </label>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 font-semibold">
                  Mains Bank
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Paper Name <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={paperName}
                  onChange={(e) => setPaperName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 font-medium"
                >
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Paper Year
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 2024"
                    value={paperYear}
                    onChange={(e) => setPaperYear(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 text-center"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Time Limit
                  </label>
                  <select
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 font-medium"
                  >
                    <option value="3 hours">3 hours (Default)</option>
                    <option value="2.5 hours">2.5 hours</option>
                    <option value="2 hours">2 hours</option>
                    <option value="1.5 hours">1.5 hours</option>
                    <option value="1 hour">1 hour</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Extraction Options Form */}
            <form onSubmit={handleProcess} className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Question Paper Subject Type
                </label>
                <select
                  value={subjectType}
                  onChange={(e) => setSubjectType(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
                >
                  <option value="formula_maths">📐 Maths (Formulas & Pix2Text LaTeX)</option>
                  <option value="physics">⚡ Physics (Equations & Diagrams)</option>
                  <option value="chemistry">🧪 Chemistry (Reactions & Structures)</option>
                  <option value="general">📄 General / Multilingual</option>
                </select>
                <span className="text-[11px] text-zinc-400 mt-1 block">
                  Uses Pix2Text formula neural net for equations ($\int, \sum$, matrices).
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Languages
                </label>
                <select
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="eng+hin">English + Hindi (eng+hin)</option>
                  <option value="eng+tam">English + Tamil (eng+tam)</option>
                  <option value="eng+tel">English + Telugu (eng+tel)</option>
                  <option value="eng+kan">English + Kannada (eng+kan)</option>
                  <option value="eng">English only (eng)</option>
                  <option value="hin">Hindi only (hin)</option>
                  <option value="eng+hin+tam+tel+kan">Multilingual (All)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Rendering DPI
                  </label>
                  <select
                    value={dpi}
                    onChange={(e) => setDpi(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value={150}>150 DPI (Fast)</option>
                    <option value={300}>300 DPI (Sharp)</option>
                    <option value={400}>400 DPI (Ultra)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Pages (From - To)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="From"
                      value={startPage}
                      onChange={(e) => setStartPage(e.target.value)}
                      className="w-1/2 text-xs px-2 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-center"
                      min={1}
                    />
                    <span className="text-zinc-400">-</span>
                    <input
                      type="number"
                      placeholder="To"
                      value={endPage}
                      onChange={(e) => setEndPage(e.target.value)}
                      className="w-1/2 text-xs px-2 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-center"
                      min={1}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={!selectedFile || processing}
                className="w-full mt-2 py-2.5 px-4 text-xs font-semibold rounded-xl bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50 transition shadow-sm flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Extracting Paper & Formulas...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Extract STEM Paper & Diagrams
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column (Results Explorer) */}
        <div className="lg:col-span-8 space-y-4">
          {result ? (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden flex flex-col">
              {/* Results Header Toolbar */}
              <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <span>📑</span> {result.exam_title || "Extracted Examination Paper"}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                      {result.total_questions} Questions
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {result.total_diagrams} Diagrams
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {result.engine_used} • {result.processing_time_sec}s
                    </span>
                  </div>
                </div>

                {/* Save All to DB action button */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={savingToDb}
                    onClick={() => onSaveQuestionsToDb(result.questions, {
                      paperName: paperName || result.paper_name || result.exam_title || selectedFile?.name?.replace(/\.[^/.]+$/, "") || "Mains Question Paper",
                      paperYear: Number(paperYear) || result.paper_year || undefined,
                      timeLimit: timeLimit || result.time_limit || "3 hours",
                      sourceFilename: selectedFile?.name
                    })}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingToDb ? "Saving to DB..." : "Save All to DB"}
                  </button>
                </div>
              </div>

              {/* Sub-tabs navigation */}
              <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6 gap-6 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setActiveSubTab("questions")}
                  className={`py-3 border-b-2 transition ${activeSubTab === "questions"
                      ? "border-sky-600 text-sky-600 dark:text-sky-400"
                      : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                >
                  Structured Questions ({result.questions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab("diagrams")}
                  className={`py-3 border-b-2 transition ${activeSubTab === "diagrams"
                      ? "border-sky-600 text-sky-600 dark:text-sky-400"
                      : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                >
                  Cropped Diagrams Gallery ({result.diagrams.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab("raw")}
                  className={`py-3 border-b-2 transition ${activeSubTab === "raw"
                      ? "border-sky-600 text-sky-600 dark:text-sky-400"
                      : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                >
                  Combined Raw OCR
                </button>
              </div>

              {/* Content Panel */}
              <div className="p-6 bg-zinc-50/40 dark:bg-zinc-950/20 max-h-[700px] overflow-y-auto">
                {/* 1. Questions View */}
                {activeSubTab === "questions" && (
                  <div className="space-y-4">
                    {result.questions.map((q, qIdx) => {
                      const paperTitle = paperName || result.paper_name || result.exam_title || selectedFile?.name?.replace(/\.[^/.]+$/, "") || "Mains Question Paper";
                      const paperYr = Number(paperYear) || result.paper_year;
                      const paperTime = timeLimit || result.time_limit || "3 hours";

                      return (
                        <div
                          key={qIdx}
                          className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden"
                        >
                          {/* Exam Title Header Banner */}
                          <div className="px-5 py-3 bg-gradient-to-r from-sky-50/80 via-indigo-50/40 to-transparent dark:from-sky-950/40 dark:via-indigo-950/20 dark:to-transparent border-b border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-600 text-white dark:bg-sky-500 shrink-0">
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

                          {/* Question Card Header & Controls */}
                          <div className="p-5 space-y-4">
                            <div className="flex items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-3 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                  Question {q.question_number || qIdx + 1}
                                </span>
                                {q.section && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium">
                                    {q.section}
                                  </span>
                                )}
                                {q.marks && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-medium">
                                    {q.marks} Marks
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => onOpenDiagramPicker({ type: "question", qIndex: qIdx })}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 transition border border-sky-200 dark:border-sky-800"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                  {q.diagrams && q.diagrams.length > 0 ? "Edit Diagram" : "+ Diagram"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onOpenQuestionEdit(q, qIdx)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 transition"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onSaveQuestionsToDb([q], {
                                    paperName: paperTitle,
                                    paperYear: Number(paperYr) || undefined,
                                    timeLimit: paperTime,
                                    sourceFilename: selectedFile?.name
                                  })}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 transition border border-emerald-200 dark:border-emerald-800"
                                  title="Save just this question to DB"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  Save
                                </button>
                              </div>
                            </div>

                            {/* Question English text (clickable to open dialog) */}
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

                              {/* Multilingual text */}
                              {q.text_hi && (
                                <div className="text-sm text-zinc-700 dark:text-zinc-300 border-l-2 border-amber-400 pl-3 mt-3">
                                  <MathMarkdownRenderer content={q.text_hi} />
                                </div>
                              )}
                            </div>

                            {/* Attached Diagrams */}
                            {q.diagrams && q.diagrams.length > 0 && (
                              <div className="space-y-2 pt-1">
                                {q.diagrams.map((diag, dIdx) => (
                                  <div
                                    key={dIdx}
                                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-950/50 flex flex-col sm:flex-row items-center gap-4"
                                  >
                                    <div
                                      onClick={() => onInspectDiagram(diag)}
                                      className="h-32 w-48 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center p-1.5 cursor-pointer hover:opacity-90 transition shrink-0"
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
                                          onClick={() => onOpenDiagramPicker({ type: "question", qIndex: qIdx })}
                                          className="text-xs text-sky-600 hover:underline font-medium"
                                        >
                                          Replace Diagram
                                        </button>
                                        <span className="text-zinc-300">•</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const copy = { ...result };
                                            copy.questions[qIdx].diagrams = [];
                                            setResult({ ...copy });
                                          }}
                                          className="text-xs text-rose-600 hover:underline font-medium"
                                        >
                                          Detach
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
                              <div className="space-y-3 pt-2 pl-3 border-l-2 border-sky-200 dark:border-sky-800">
                                {q.subquestions.map((sq, sqIdx) => (
                                  <div
                                    key={sqIdx}
                                    className="rounded-lg bg-zinc-50/80 dark:bg-zinc-950/40 p-3 border border-zinc-200 dark:border-zinc-800/80 space-y-2"
                                  >
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                        Subquestion {sq.subquestion_number}
                                      </span>
                                      {sq.marks && (
                                        <span className="text-zinc-500">{sq.marks} marks</span>
                                      )}
                                    </div>
                                    {sq.text_en && (
                                      <div className="text-xs">
                                        <MathMarkdownRenderer content={sq.text_en} />
                                      </div>
                                    )}
                                    {sq.diagrams && sq.diagrams.length > 0 && (
                                      <div className="flex items-center gap-3 pt-1">
                                        <img
                                          src={getDiagramSrc(sq.diagrams[0])}
                                          alt="Subquestion diagram"
                                          onClick={() => onInspectDiagram(sq.diagrams![0])}
                                          className="h-20 w-28 object-contain rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1 cursor-pointer"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => onOpenDiagramPicker({ type: "subquestion", qIndex: qIdx, sqIndex: sqIdx })}
                                          className="text-xs text-sky-600 hover:underline"
                                        >
                                          Edit Diagram
                                        </button>
                                      </div>
                                    )}
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

                {/* 2. Cropped Diagrams Gallery */}
                {activeSubTab === "diagrams" && (
                  <div>
                    {result.diagrams.length === 0 ? (
                      <div className="py-12 text-center text-zinc-400">
                        <span className="text-4xl">🖼️</span>
                        <p className="text-sm font-medium mt-2">No diagrams detected in this paper.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {result.diagrams.map((diag, dIdx) => (
                          <div
                            key={dIdx}
                            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 flex flex-col justify-between"
                          >
                            <div
                              onClick={() => onInspectDiagram(diag)}
                              className="h-36 w-full rounded-lg bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center p-2 cursor-pointer hover:opacity-90 transition"
                            >
                              <img
                                src={getDiagramSrc(diag)}
                                alt={diag.title || "Diagram"}
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                            <div className="mt-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                              <h5 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                {diag.title || `Figure ${dIdx + 1}`}
                              </h5>
                              <p className="text-[11px] text-zinc-400">
                                Page {diag.page_number} • {diag.width}×{diag.height}px
                              </p>
                              <div className="mt-2 flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={() => onInspectDiagram(diag)}
                                  className="text-xs font-medium text-sky-600 hover:underline"
                                >
                                  🔍 Inspect
                                </button>
                                <a
                                  href={getDiagramSrc(diag)}
                                  download={`${diag.id}.png`}
                                  className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                                >
                                  📥 PNG
                                </a>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Raw OCR View */}
                {activeSubTab === "raw" && (
                  <div>
                    <textarea
                      readOnly
                      rows={20}
                      value={result.raw_text || ""}
                      className="w-full text-xs font-mono p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 leading-relaxed"
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center flex flex-col items-center justify-center min-h-[450px]">
              <div className="w-16 h-16 rounded-full bg-sky-100 dark:bg-sky-950/60 flex items-center justify-center text-3xl mb-3">
                📐
              </div>
              <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
                STEM OCR Extraction Ready
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mt-1 leading-relaxed">
                Upload a Mathematics, Physics, or Chemistry question paper. Pix2Text will extract
                formulas into LaTeX, and visual diagrams/circuits will be automatically cropped and
                attached to each question card.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mains Question Paper Setup Modal (Prompted on File Upload) */}
      {showUploadPromptModal && selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-lg w-full border border-sky-300 dark:border-sky-800 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                  mains_question_papers table
                </span>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-1.5 flex items-center gap-2">
                  <span>📑</span> Setup Question Paper
                </h3>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                ⏱️ Default: 3 hours
              </span>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Please specify the question paper details for{" "}
              <strong className="text-zinc-900 dark:text-zinc-200">
                {selectedFile.name}
              </strong>
              . These fields will be stored in the{" "}
              <code className="text-sky-600 dark:text-sky-400 font-mono">
                mains_question_papers
              </code>{" "}
              table and linked to all extracted questions.
            </p>

            <div className="space-y-3.5 bg-zinc-50 dark:bg-zinc-950/60 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              {/* Paper Name (papername) */}
              <div>
                <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                  Paper Name <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={paperName}
                  onChange={(e) => setPaperName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 font-medium focus:ring-2 focus:ring-sky-500/20"
                >
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

              {/* Grid: Paper Year (paperyear) & Time Limit (timelimit) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                    Paper Year
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 2024"
                    value={paperYear}
                    onChange={(e) => setPaperYear(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 text-center font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                    Time Limit (timelimit)
                  </label>
                  <select
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 font-medium"
                  >
                    <option value="3 hours">3 hours (Default)</option>
                    <option value="2.5 hours">2.5 hours</option>
                    <option value="2 hours">2 hours</option>
                    <option value="1.5 hours">1.5 hours</option>
                    <option value="1 hour">1 hour</option>
                  </select>
                </div>
              </div>

              {/* Subject Type */}
              <div>
                <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                  Subject Category
                </label>
                <select
                  value={subjectType}
                  onChange={(e) => setSubjectType(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 font-medium"
                >
                  <option value="formula_maths">📐 Maths (Pix2Text Neural Formulas & Equations)</option>
                  <option value="physics">⚡ Physics (Formulas & Cropped Diagrams)</option>
                  <option value="chemistry">🧪 Chemistry (Formulas & Reactions)</option>
                  <option value="general">📄 General / Multilingual Text</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowUploadPromptModal(false)}
                className="px-3.5 py-2 text-xs font-medium rounded-xl text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
              >
                Configure Manually in Form
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadPromptModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                >
                  Confirm & Review Settings
                </button>
                <button
                  type="button"
                  onClick={handleConfirmModalAndExtract}
                  disabled={processing}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-sky-600 hover:bg-sky-500 text-white transition shadow-sm flex items-center gap-1.5"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <span>Start OCR Extraction</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gemini API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full border border-zinc-200 dark:border-zinc-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-500" /> Gemini API Key Configuration
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Required for structuring questions into cards, fixing Hindi/multilingual typography,
              and mapping cropped diagrams to their target questions.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Gemini Model
                </label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="gemini-1.5-flash-8b">gemini-1.5-flash-8b (Fast & Lowest Cost)</option>
                  <option value="gemini-2.5-flash">gemini-2.5-flash (Fast & Highly Accurate)</option>
                  <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveGeminiKey}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition shadow-xs"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Details Full Dialog */}
      <QuestionDetailModal
        question={inspectQuestion}
        onClose={() => setInspectQuestion(null)}
        onEdit={(q) => {
          const idx = result?.questions.findIndex((item) => item === q || item.id === q.id) ?? -1;
          onOpenQuestionEdit(q, idx >= 0 ? idx : 0);
        }}
        onOpenDiagramPicker={(q) => {
          const idx = result?.questions.findIndex((item) => item === q || item.id === q.id) ?? -1;
          onOpenDiagramPicker({ type: "question", qIndex: idx >= 0 ? idx : 0 });
        }}
        onInspectDiagram={(diag) => onInspectDiagram(diag)}
      />
    </div>
  );
}
