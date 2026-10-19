"use client";

import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import {
  BookOpen,
  ArrowRight,
  ExternalLink,
  Target,
  Sparkles,
  Search,
  CheckCircle2,
  FileText,
} from "lucide-react";

interface PYQItem {
  id: string;
  year: number | string;
  exam: string;
  subject: string;
  paper: string;
  question: string;
  options?: string[];
  answer?: string;
  explanation?: string;
}

const SAMPLE_PYQS: PYQItem[] = [
  {
    id: "pyq-1",
    year: "2024",
    exam: "UPSC Civil Services (Prelims)",
    subject: "Polity & Governance",
    paper: "GS Paper I",
    question: "With reference to the Parliament of India, consider the following statements regarding the powers of the Speaker of Lok Sabha...",
    options: [
      "The Speaker presides over a joint sitting of the two Houses of Parliament.",
      "The Speaker decides whether a bill is a Money Bill or not.",
      "The Speaker's decision on a Money Bill can be challenged in any court of law.",
      "Both 1 and 2 are correct.",
    ],
    answer: "Both 1 and 2 are correct.",
    explanation: "Under Article 110(3), if any question arises whether a Bill is a Money Bill or not, the decision of the Speaker of the House of the People thereon shall be final.",
  },
  {
    id: "pyq-2",
    year: "2024",
    exam: "UPSC Civil Services (Prelims)",
    subject: "Economy & Development",
    paper: "GS Paper I",
    question: "In India, which of the following is responsible for maintaining price stability by controlling inflation?",
    options: [
      "Department of Consumer Affairs",
      "Expenditure Management Commission",
      "Financial Stability and Development Council",
      "Reserve Bank of India",
    ],
    answer: "Reserve Bank of India",
    explanation: "The Reserve Bank of India (RBI) operates the Monetary Policy Framework under the RBI Act to maintain price stability while keeping in mind the objective of growth.",
  },
  {
    id: "pyq-3",
    year: "2023",
    exam: "UPSC Civil Services (Prelims)",
    subject: "Environment & Ecology",
    paper: "GS Paper I",
    question: "Consider the following statements regarding the Carbon Credit Trading Scheme, 2023 in India...",
    options: [
      "It was notified under the Energy Conservation Act, 2001.",
      "Bureau of Energy Efficiency (BEE) is the administrator for the scheme.",
      "Both 1 and 2",
      "Neither 1 nor 2",
    ],
    answer: "Both 1 and 2",
    explanation: "Ministry of Power notified the Carbon Credit Trading Scheme under the Energy Conservation (Amendment) Act 2022 with BEE as the administrator.",
  },
  {
    id: "pyq-4",
    year: "2023",
    exam: "UPSC Civil Services (Prelims)",
    subject: "History & Culture",
    paper: "GS Paper I",
    question: "With reference to ancient India, which of the following were famous port towns of the Chola Empire?",
    options: [
      "Puhar (Kaveripattinam)",
      "Tamralipti",
      "Muziris",
      "Barbaricum",
    ],
    answer: "Puhar (Kaveripattinam)",
    explanation: "Puhar, also known as Kaveripattinam, was the prominent coastal port town of the early Chola rulers.",
  },
  {
    id: "pyq-5",
    year: "2022",
    exam: "UPSC Civil Services (Prelims)",
    subject: "Science & Technology",
    paper: "GS Paper I",
    question: "Consider the following statements with reference to Web 3.0 technology and decentralization...",
    options: [
      "Web 3.0 technology enables individuals to control their own data.",
      "In Web 3.0 world, there can be blockchain based social networks.",
      "Web 3.0 is operated by a single centralized cloud consortium.",
      "Both 1 and 2 are correct.",
    ],
    answer: "Both 1 and 2 are correct.",
    explanation: "Web 3.0 represents a decentralized internet architecture powered by distributed ledger technologies.",
  },
];

export default function PreviousYearQuestions() {
  const [pyqs, setPyqs] = useState<PYQItem[]>(SAMPLE_PYQS);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://app.yuktiprep.com").replace(/\/$/, "");

  return (
    <main className="min-h-screen bg-[#F8FAFC]">
      <Navbar />

      <section className="pt-28 sm:pt-36 pb-20 px-4 sm:px-6 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-[11px] font-extrabold tracking-widest text-[var(--primaryblue)] uppercase block mb-2">
            Exam Archive &amp; Trend Analysis
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[var(--primarynavy)] tracking-tight mb-4">
            Previous Year Questions
          </h1>
          <p className="text-sm sm:text-base text-[#49605c] max-w-2xl mx-auto leading-relaxed">
            Practice actual PYQs with detailed explanations, syllabus links, and official context. Master high-frequency concepts tested in previous examinations.
          </p>
        </div>

        {/* 5 PYQ Cards */}
        <div className="flex flex-col gap-6">
          {pyqs.slice(0, 5).map((q, i) => (
            <article
              key={q.id}
              className="bg-white rounded-[20px] p-5 sm:p-7 shadow-xs border border-[rgba(18,47,43,0.06)] flex flex-col gap-4 transition-all hover:shadow-md"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="bg-[#eef7fa] text-[var(--primarynavy)] font-bold text-[11px] px-3 py-1 rounded-md">
                  {q.exam} · {q.year}
                </span>
                <span className="text-xs font-semibold text-[var(--teal)]">
                  {q.subject}
                </span>
              </div>

              <h3 className="text-base font-bold text-[var(--primarynavy)] leading-snug">
                Q{i + 1}. {q.question}
              </h3>

              {q.options && q.options.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-1">
                  {q.options.map((opt, idx) => {
                    const optLetter = String.fromCharCode(65 + idx);
                    return (
                      <div
                        key={idx}
                        className="text-left text-xs p-3 rounded-xl border border-gray-100 bg-[#f8fbfa] text-[#2c3d39] flex items-start gap-2"
                      >
                        <strong className="text-[var(--primarynavy)] shrink-0">
                          {optLetter}.
                        </strong>
                        <span className="flex-1">{opt}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Solution box */}
              {revealed[q.id] && (
                <div className="text-xs bg-[#f4f9fb] p-3.5 rounded-xl border-l-4 border-[var(--teal)] text-[#3f5753] leading-relaxed">
                  <div className="font-bold text-[var(--primarynavy)] mb-1 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>Answer: {q.answer}</span>
                  </div>
                  <p>{q.explanation}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRevealed((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                  className="px-3.5 py-1.5 bg-[#f0f4f8] text-[var(--primarynavy)] font-bold rounded-lg text-xs hover:bg-[#e2eaf0] transition-colors cursor-pointer"
                >
                  {revealed[q.id] ? "Hide Solution" : "Check Solution"}
                </button>
              </div>
            </article>
          ))}

          {/* Navigation banner to app.yuktiprep.com */}
          <div className="text-center pt-4 pb-8">
            <a
              href={`${appUrl}/tests?tab=pyq`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3.5 bg-[var(--primarynavy)] text-white font-bold text-sm rounded-full shadow-md hover:bg-black transition-all inline-flex items-center gap-2 mx-auto cursor-pointer"
            >
              Access Full 10-Year PYQ Bank on Student Portal <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
