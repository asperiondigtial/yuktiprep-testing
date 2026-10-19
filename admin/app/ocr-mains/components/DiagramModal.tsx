"use client";

import React from "react";
import { X, Download, ZoomIn } from "lucide-react";
import { DiagramItem } from "../types";

interface DiagramModalProps {
  diagram: DiagramItem | null;
  onClose: () => void;
}

export default function DiagramModal({ diagram, onClose }: DiagramModalProps) {
  if (!diagram) return null;

  const imgSrc = diagram.data_url || (diagram.image_url.startsWith("http") ? diagram.image_url : `${process.env.NEXT_PUBLIC_OCR_API_URL || "http://localhost:8000"}${diagram.image_url}`);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60">
          <div className="flex items-center gap-2">
            <span className="text-xl">🖼️</span>
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {diagram.title || "Cropped Diagram"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Page {diagram.page_number} • {diagram.width} × {diagram.height} px
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image Preview Box */}
        <div className="p-6 overflow-auto flex items-center justify-center bg-zinc-100/50 dark:bg-zinc-950/40 flex-1 min-h-[350px]">
          <img
            src={imgSrc}
            alt={diagram.title || "Cropped figure"}
            className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-sm border border-zinc-200/60 dark:border-zinc-800"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60">
          <div className="flex items-center gap-2">
            {diagram.question_ref && (
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                {diagram.question_ref}
              </span>
            )}
            <span className="text-xs text-zinc-500">
              High-resolution vector/bitmap crop
            </span>
          </div>

          <a
            href={imgSrc}
            download={`${diagram.id || "diagram"}.png`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Download PNG
          </a>
        </div>
      </div>
    </div>
  );
}
