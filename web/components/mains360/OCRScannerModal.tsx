"use client";

import React, { useState, useEffect } from "react";
import {
  Camera,
  CheckCircle2,
  ScanLine,
  X,
  FileText,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const SAMPLE_OCR_PAGES = [
  {
    id: "page-sample-1",
    title: "Handwritten Sample: GS-II Basic Structure",
    extractedText: `The basic structure doctrine was propounded by the Supreme Court in the landmark Kesavananda Bharati case in 1973. It says that Parliament can amend any part of the Constitution under Article 368 but cannot change its basic structure like democracy, secularism and rule of law.

This doctrine has stopped authoritarianism in India. During emergency, 39th amendment tried to put election of PM outside judicial review, but SC struck it down in Raj Narain case. In Minerva Mills case, court held that judicial review and balance between Fundamental rights and DPSP is basic structure.

However, critics say that basic structure is not defined anywhere in the constitution. It leads to judicial activism and friction between legislature and judiciary.

In conclusion, basic structure is very important for Indian democracy and protects citizen rights.`,
    confidence: "98.7%",
    linesDetected: 22,
  },
  {
    id: "page-sample-2",
    title: "Handwritten Sample: GS-III AI Regulation",
    extractedText: `Artificial Intelligence (AI) is transforming the world rapidly. India has huge opportunity to use AI in many sectors.

Opportunities:
1. Economy: AI will increase GDP and help in IT sector.
2. Agriculture: Weather forecasting and crop monitoring.
3. Health: AI doctors and diagnosis.
4. Education: Personalized learning for students.

Risks:
1. Job loss in IT and call centres.
2. Deepfakes and crime.
3. Privacy violations.

Suggestions:
Government should make strong law for AI and promote research. NITI Aayog AI for all must be implemented.`,
    confidence: "97.9%",
    linesDetected: 19,
  },
];

interface OCRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTextExtracted: (text: string) => void;
}

export function OCRScannerModal({
  isOpen,
  onClose,
  onTextExtracted,
}: OCRScannerModalProps) {
  const [selectedSample, setSelectedSample] = useState(SAMPLE_OCR_PAGES[0]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [extractedText, setExtractedText] = useState("");

  useEffect(() => {
    if (isOpen) {
      setExtractedText(selectedSample.extractedText);
      setIsScanning(false);
      setScanProgress(0);
    }
  }, [isOpen, selectedSample]);

  if (!isOpen) return null;

  const handleStartScan = () => {
    setIsScanning(true);
    setScanProgress(10);

    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          return 100;
        }
        return prev + 25;
      });
    }, 280);
  };

  const handleTransfer = () => {
    onTextExtracted(extractedText);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 md:p-8 shadow-2xl border border-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E6EE] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#DDF3F5] text-[#0F7F8C]">
              <ScanLine className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#1F314D]">
                Handwritten Answer Scanner & Vision OCR
              </h3>
              <p className="text-xs text-[#647084]">
                Neural OCR engine optimized for UPSC Question-cum-Answer Booklets (QCAB)
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

        {/* Sample Selectors */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#647084]">
            Select Sample Sheet:
          </span>
          {SAMPLE_OCR_PAGES.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => {
                setSelectedSample(sample);
                setExtractedText(sample.extractedText);
              }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                selectedSample.id === sample.id
                  ? "bg-[#1F314D] text-white"
                  : "bg-neutral-100 text-[#1F314D] hover:bg-neutral-200"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>{sample.title}</span>
            </button>
          ))}
        </div>

        {/* Dual Layout: Mock QCAB Sheet & Extracted Transcript */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left Column: QCAB Visualizer */}
          <div className="flex flex-col rounded-2xl border border-dashed border-[#E2E6EE] bg-[#F8FAFC] p-4 relative min-h-[340px]">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-semibold text-indigo-700">
                UPSC QCAB Margin Format
              </span>
              <span className="text-[#647084]">
                {selectedSample.linesDetected} lines detected
              </span>
            </div>

            {/* Answer Booklet Preview */}
            <div className="relative flex-1 rounded-xl bg-[#FFFDF9] p-4 shadow-inner font-mono text-xs text-neutral-800 overflow-hidden min-h-[220px]">
              {/* Margin rules */}
              <div className="absolute top-0 bottom-0 left-8 w-[1.5px] bg-red-400/40" />
              <div className="absolute top-0 bottom-0 right-8 w-[1.5px] bg-red-400/40" />

              <div className="text-[10px] uppercase tracking-wider text-neutral-400 text-center mb-2">
                (उम्मीदवारों को इस हाशिए में नहीं लिखना चाहिए / Candidates must not write on this margin)
              </div>

              <div className="px-7 whitespace-pre-line leading-relaxed text-neutral-700">
                {selectedSample.extractedText.slice(0, 320)}...
              </div>

              {/* Laser Scanning Animation */}
              {isScanning && (
                <div
                  className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#0F7F8C] to-transparent shadow-[0_0_12px_#0F7F8C] transition-all"
                  style={{ top: `${scanProgress}%` }}
                />
              )}
            </div>

            <div className="mt-4">
              <Button
                type="button"
                onClick={handleStartScan}
                disabled={isScanning}
                className="w-full rounded-xl bg-[#0F7F8C] hover:bg-[#0c6b76] text-white text-xs font-semibold h-10"
              >
                {isScanning ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    <span>Extracting Neural Vision OCR ({scanProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <ScanLine className="mr-2 h-4 w-4" />
                    <span>Scan & Ingest Handwritten Text</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right Column: Extracted Transcript */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[#1F314D] flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-[#0F7F8C]" />
                <span>Extracted Transcript (Editable)</span>
              </label>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="h-3 w-3" />
                Confidence: {selectedSample.confidence}
              </span>
            </div>

            <textarea
              className="w-full flex-1 min-h-[260px] rounded-2xl border border-[#E2E6EE] bg-white p-3.5 text-xs md:text-sm leading-relaxed text-[#1F314D] focus:border-[#0F7F8C] focus:outline-none focus:ring-1 focus:ring-[#0F7F8C]"
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              placeholder="Extracted text will appear here..."
            />

            <div className="mt-4 flex items-center justify-end gap-3">
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
                onClick={handleTransfer}
                className="rounded-xl bg-[#233249] hover:bg-[#1a2536] text-white text-xs font-semibold"
              >
                <Sparkles className="mr-2 h-4 w-4 text-amber-300" />
                <span>Transfer to Answer Studio</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
