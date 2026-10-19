"use client";

import React, { useState } from "react";
import { X, Upload, Trash2, Check, Search, ZoomIn } from "lucide-react";
import { DiagramItem } from "../types";

interface DiagramPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetLabel: string;
  currentDiagrams: DiagramItem[];
  availableDiagrams: DiagramItem[];
  onAssignDiagram: (diag: DiagramItem) => void;
  onDetachDiagram: () => void;
  onUploadCustomDiagram: (file: File) => Promise<DiagramItem | null>;
  onInspectDiagram: (diag: DiagramItem) => void;
}

export default function DiagramPickerModal({
  isOpen,
  onClose,
  targetLabel,
  currentDiagrams,
  availableDiagrams,
  onAssignDiagram,
  onDetachDiagram,
  onUploadCustomDiagram,
  onInspectDiagram,
}: DiagramPickerModalProps) {
  const [uploading, setUploading] = useState(false);
  const [filterText, setFilterText] = useState("");

  if (!isOpen) return null;

  const currentDiagId = currentDiagrams[0]?.id;
  const filtered = availableDiagrams.filter((d) => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return (
      (d.title || "").toLowerCase().includes(q) ||
      (d.question_ref || "").toLowerCase().includes(q) ||
      `page ${d.page_number}`.includes(q)
    );
  });

  const handleCustomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const newDiag = await onUploadCustomDiagram(file);
      if (newDiag) {
        onAssignDiagram(newDiag);
        onClose();
      }
    } catch (err: any) {
      alert("Failed to upload custom diagram: " + err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const getImgSrc = (diag: DiagramItem) => {
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
        className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-4xl w-full flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60">
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>🖼️</span> Select & Manage Diagram
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Choose from detected document diagrams or upload a custom image for{" "}
              <strong className="text-sky-600 dark:text-sky-400">{targetLabel}</strong>.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current status bar */}
        <div className="px-6 py-3 bg-sky-50/70 dark:bg-sky-950/30 border-b border-sky-100 dark:border-sky-900/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sky-900 dark:text-sky-200">
              Target: <span className="bg-white dark:bg-zinc-800 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800">{targetLabel}</span>
            </span>
            <span className="text-zinc-500">•</span>
            <span className="text-zinc-600 dark:text-zinc-300">
              Current:{" "}
              {currentDiagrams.length > 0 ? (
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  {currentDiagrams[0].title || "1 Diagram Attached"}
                </span>
              ) : (
                <span className="text-zinc-400 italic">None Attached</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {currentDiagrams.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onDetachDiagram();
                  onClose();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 dark:text-rose-300 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 rounded border border-rose-200 dark:border-rose-800 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Detach Diagram
              </button>
            )}

            <label className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded cursor-pointer transition shadow-xs">
              <Upload className="w-3.5 h-3.5" />
              {uploading ? "Uploading..." : "Upload Custom"}
              <input
                type="file"
                accept="image/*"
                onChange={handleCustomUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-6 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 bg-white dark:bg-zinc-900">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            type="text"
            placeholder="Search detected diagrams by title, page number..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full text-xs bg-transparent focus:outline-hidden text-zinc-800 dark:text-zinc-200"
          />
          <span className="text-xs text-zinc-400 shrink-0">
            {filtered.length} / {availableDiagrams.length}
          </span>
        </div>

        {/* Diagrams Grid */}
        <div className="p-6 overflow-y-auto flex-1 bg-zinc-50/50 dark:bg-zinc-950/40">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 flex flex-col items-center">
              <span className="text-4xl mb-2">🖼️</span>
              <p className="text-sm font-medium">No diagrams match your filter.</p>
              <p className="text-xs text-zinc-500 mt-1">
                You can click "Upload Custom" above to upload an image from your device.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filtered.map((diag) => {
                const isSelected = diag.id === currentDiagId;
                return (
                  <div
                    key={diag.id}
                    className={`group relative rounded-xl border p-2.5 transition flex flex-col justify-between bg-white dark:bg-zinc-900 ${
                      isSelected
                        ? "border-sky-500 ring-2 ring-sky-500/20 shadow-sm"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xs"
                    }`}
                  >
                    {/* Thumbnail wrap */}
                    <div
                      onClick={() => {
                        onAssignDiagram(diag);
                        onClose();
                      }}
                      className="relative h-36 w-full rounded-lg bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center overflow-hidden cursor-pointer group-hover:opacity-95"
                    >
                      <img
                        src={getImgSrc(diag)}
                        alt={diag.title || "Diagram"}
                        className="max-h-full max-w-full object-contain p-1"
                      />

                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-sky-600 text-white rounded-full p-1 shadow-md">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspectDiagram(diag);
                        }}
                        className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition shadow-sm"
                        title="Inspect Zoom"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Meta */}
                    <div className="mt-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                      <div className="flex items-start justify-between gap-1">
                        <div className="truncate">
                          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {diag.title || "Diagram Figure"}
                          </p>
                          <p className="text-[11px] text-zinc-500 truncate">
                            Page {diag.page_number} • {diag.width}×{diag.height}px
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onAssignDiagram(diag);
                            onClose();
                          }}
                          className={`w-full py-1 text-xs font-medium rounded-lg transition ${
                            isSelected
                              ? "bg-sky-600 text-white"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-sky-50 dark:hover:bg-sky-950 hover:text-sky-600"
                          }`}
                        >
                          {isSelected ? "✓ Selected" : "Select Diagram"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            Click any diagram card to attach it to {targetLabel}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
