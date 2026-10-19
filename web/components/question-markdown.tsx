"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface QuestionMarkdownProps {
  content: string;
  className?: string;
}

export const QuestionMarkdown: React.FC<QuestionMarkdownProps> = ({
  content,
  className = "",
}) => {
  if (!content) return null;

  return (
    <div
      className={`question-markdown text-inherit leading-relaxed ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-3 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <table className="w-full border-collapse text-left text-xs md:text-sm" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-amber-500/10 dark:bg-amber-950/30" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border-b border-zinc-100 dark:border-zinc-800/60 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="my-1.5 leading-relaxed" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-outside pl-5 my-2 space-y-1" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-outside pl-5 my-2 space-y-1" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="pl-0.5 leading-relaxed" {...props} />
          ),
          h1: ({ node, ...props }) => (
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-4 mb-2" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-3 mb-1.5" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-2 mb-1" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-amber-500 bg-amber-500/5 dark:bg-amber-500/10 py-1.5 px-3 rounded-r-lg italic my-2 text-zinc-700 dark:text-zinc-300 text-xs" {...props} />
          ),
          pre: ({ node, ...props }) => (
            <pre className="overflow-x-auto rounded-lg bg-zinc-900 text-zinc-100 p-3 text-xs font-mono shadow-2xs my-2" {...props} />
          ),
          code: ({ node, inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <code className="rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 px-1 py-0.5 font-mono text-xs font-medium" {...props}>
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
          hr: ({ node, ...props }) => (
            <hr className="my-3 border-zinc-200 dark:border-zinc-800" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default QuestionMarkdown;
