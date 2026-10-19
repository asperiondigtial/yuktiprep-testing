"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface MathMarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MathMarkdownRenderer({ content, className = "" }: MathMarkdownRendererProps) {
  if (!content) return null;

  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none text-zinc-800 dark:text-zinc-200 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          table: ({ ...props }) => (
            <div className="overflow-x-auto my-3 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <table className="w-full border-collapse text-left text-xs md:text-sm" {...props} />
            </div>
          ),
          th: ({ ...props }) => (
            <th className="border-b border-zinc-200 dark:border-zinc-800 bg-sky-50 dark:bg-sky-950/40 px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100" {...props} />
          ),
          td: ({ ...props }) => (
            <td className="border-b border-zinc-100 dark:border-zinc-800 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300" {...props} />
          ),
          p: ({ ...props }) => <p className="my-1.5 leading-relaxed" {...props} />,
          ul: ({ ...props }) => <ul className="list-disc pl-5 my-1.5 space-y-1" {...props} />,
          ol: ({ ...props }) => <ol className="list-decimal pl-5 my-1.5 space-y-1" {...props} />,
          li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
          code: ({ inline, className: codeClass, children, ...props }: any) => {
            if (inline) {
              return (
                <code className="rounded bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 font-mono text-xs font-medium text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={`${codeClass} rounded block bg-zinc-900 text-zinc-100 p-3 my-2 text-xs font-mono overflow-x-auto`} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
