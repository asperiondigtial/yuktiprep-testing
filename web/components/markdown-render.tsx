"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface MarkdownRenderProps {
  content: string;
  className?: string;
}

/**
 * Preprocesses markdown content from AI to ensure standard spacing,
 * clean line breaks around headings and formulas, and robust KaTeX math rendering.
 */
function preprocessMarkdown(raw: string): string {
  if (!raw) return "";

  let text = raw.replace(/\r\n/g, "\n");

  // Convert standard LaTeX display math \[ ... \] to $$ ... $$
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, formula) => `\n\n$$\n${formula.trim()}\n$$\n\n`);

  // Convert standard LaTeX inline math \( ... \) to $ ... $
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, formula) => `$${formula.trim()}$`);

  // Convert isolated single dollar on its own line (e.g. "$\n\nformula\n\n$") to block math "$$"
  text = text.replace(/(^|\n)[ \t]*\$[ \t]*(\n|$)/g, "$1\n$$\n$2");

  // Clean up $$ ... $$ block math: ensure clean newlines without stray blanks inside
  text = text.replace(/\$\$[\s\n]*([\s\S]*?)[\s\n]*\$\$/g, (_, formula) => {
    return `\n\n$$\n${formula.trim()}\n$$\n\n`;
  });

  // Ensure numbered main points (e.g. "1. What is LCM?") have a blank line before them if preceded by a sentence
  text = text.replace(/([^\n#])\n(\d+\.\s+[A-Z\u0900-\u097F])/g, "$1\n\n$2");

  // Ensure "Method A:", "Model 1:", "Example:" headers have a preceding blank line
  text = text.replace(/([^\n#])\n((?:Method|Model|Step|Case|Rule)\s+[A-Za-z0-9]+:)/gi, "$1\n\n$2");

  return text;
}

export const MarkdownRender: React.FC<MarkdownRenderProps> = ({
  content,
  className = "",
}) => {
  const processedContent = useMemo(() => preprocessMarkdown(content), [content]);

  return (
    <div
      className={`markdown-content prose prose-sm max-w-none text-[#1D2B45] text-[13.5px] md:text-[14px] leading-relaxed
        ${className}`}
    >
      <style jsx global>{`
        .markdown-content .katex-mathml {
          display: none !important;
        }
        .markdown-content .katex {
          font-size: 1.05em;
          text-rendering: auto;
          white-space: normal;
          line-height: normal;
        }
        .markdown-content .katex-display {
          display: block;
          margin: 0.85rem 0;
          text-align: center;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 0.25rem 0;
        }
        .markdown-content .katex-display > .katex {
          display: inline-block;
          text-align: initial;
        }
      `}</style>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { output: "html", strict: false, throwOnError: false }]]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="text-lg md:text-xl font-bold text-[#172E55] mt-4 mb-2" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-base md:text-lg font-bold text-[#172E55] mt-3.5 mb-1.5" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-sm md:text-base font-bold text-[#172E55] mt-3 mb-1.5" {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className="text-xs md:text-sm font-bold text-[#17898A] mt-2.5 mb-1" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="my-2 leading-[1.7] text-[#223354]" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="my-2.5 space-y-1.5 list-disc pl-5 text-[#223354]" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="my-2.5 space-y-1.5 list-decimal pl-5 text-[#223354]" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-relaxed pl-1 my-0.5" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-[#142646]" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-3.5 border-[#17898A] bg-[#E9F7F7]/60 my-3 rounded-r-xl px-4 py-2.5 text-xs md:text-sm text-[#1D2B45] italic" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-3 rounded-xl border border-neutral-200 shadow-xs">
              <table className="w-full border-collapse text-left text-xs md:text-sm" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="border-b border-neutral-200 bg-[#E9F7F7] px-3.5 py-2.5 text-xs font-semibold text-[#172E55]" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border-b border-neutral-100 px-3.5 py-2 text-xs md:text-sm text-neutral-700" {...props} />
          ),
          pre: ({ node, ...props }) => (
            <pre className="overflow-x-auto rounded-xl bg-[#1E293B] p-4 text-xs md:text-sm font-mono text-neutral-100 shadow-xs my-3 leading-relaxed" {...props} />
          ),
          code: ({ node, inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <code className="rounded bg-[#E9F7F7] px-1.5 py-0.5 font-mono text-xs font-medium text-[#17898A]" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          hr: () => <div className="my-3" />,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRender;
