"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Clock,
  Sparkles,
  Search,
  BookOpen,
  ArrowRight,
  Layers,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { OcrMainsPaper } from "@/types/mains360";
import { getMainsPapers } from "@/lib/mains360-api";
import { MasteryAnalytics } from "./MasteryAnalytics";

interface Mains360ContainerProps {
  initialSubTab?: "simulator" | "analytics";
}

export function Mains360Container({ initialSubTab = "simulator" }: Mains360ContainerProps) {
  const router = useRouter();
  const [subTab, setSubTab] = useState<"simulator" | "analytics">(initialSubTab);
  const [papers, setPapers] = useState<OcrMainsPaper[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
      return;
    }
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const sub = params.get("subtab");
      if (sub === "analytics" || sub === "simulator") {
        setSubTab(sub);
      }
    }
  }, [initialSubTab]);

  // Fetch papers from ocr-api
  const loadPapers = async () => {
    setLoading(true);
    try {
      const data = await getMainsPapers();
      setPapers(data);
    } catch (err) {
      console.error("Failed to load papers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPapers();
  }, []);

  // When a user selects a question paper, route directly to /tests/{paper.id}
  const handleSelectPaper = (paper: OcrMainsPaper) => {
    const targetId = paper.id || paper.paperid || (paper as any).paper_id;
    if (targetId) {
      router.push(`/tests/${targetId}`);
    }
  };

  const filteredPapers = papers.filter((p) => {
    const name = p.paper_name || p.papername || "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Sub-tab switcher: Simulator | Analytics */}
      <section className="mt-2 flex items-center justify-between flex-wrap gap-4">
        <div className="flex rounded-[22px] border border-[#E2E6EE] bg-white p-1 w-full sm:w-auto">
          {[
            { label: "Simulator", value: "simulator", icon: BookOpen },
            { label: "Analytics", value: "analytics", icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = subTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setSubTab(tab.value as any)}
                className={`flex items-center justify-center gap-2 rounded-[18px] px-6 py-2 text-xs font-semibold transition ${isActive
                  ? "bg-[#233249] text-white shadow-xs"
                  : "text-[#1F314D] hover:bg-neutral-50"
                  }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {subTab === "simulator" && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#647084]" />
              <input
                type="text"
                placeholder="Search question papers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-[#E2E6EE] bg-white pl-10 pr-4 py-2 text-xs text-[#1F314D] placeholder-[#647084] focus:border-[#0F7F8C] focus:outline-none focus:ring-1 focus:ring-[#0F7F8C]"
              />
            </div>
            <button
              type="button"
              onClick={loadPapers}
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[#E2E6EE] bg-white text-[#647084] hover:bg-neutral-50 transition"
              title="Refresh Papers"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        )}
      </section>

      {/* Simulator View: Papers Grid */}
      {subTab === "simulator" && (
        <>

          {/* Papers Grid */}
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <RefreshCw className="h-7 w-7 animate-spin text-[#0F7F8C]" />
            </div>
          ) : filteredPapers.length === 0 ? (
            <div className="rounded-3xl border border-[#E2E6EE] bg-white p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-[#647084] mb-3">
                <BookOpen className="h-6 w-6" />
              </div>
              <h4 className="text-base font-bold text-[#1F314D]">No Question Papers Found</h4>
              <p className="text-xs text-[#647084] mt-1 max-w-md mx-auto">
                No papers currently match your search criteria. You can ingest papers in the OCR Ingestion admin or try refreshing.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredPapers.map((paper) => {
                const title = paper.paper_name || paper.papername || "Untitled Paper";
                const qCount = paper.questions_count || 20;
                const duration = paper.time_limit || paper.timelimit || "3 hours";
                const marks = paper.total_marks || 250;

                return (
                  <div
                    key={paper.id}
                    className="flex flex-col justify-between rounded-3xl border border-[#E2E6EE] bg-white p-5 shadow-xs hover:border-[#0F7F8C]/60 hover:shadow-md transition group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        {paper.paper_year && (
                          <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-[#1F314D]">
                            Year: {paper.paper_year}
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-bold text-[#1F314D] group-hover:text-[#0F7F8C] transition line-clamp-2">
                        {title}
                      </h4>

                      <div className="mt-4 grid grid-cols-3 gap-2 border-y border-[#E2E6EE] py-3 text-center text-xs">
                        <div>
                          <div className="text-[10px] text-[#647084]">Questions</div>
                          <div className="font-bold text-[#1F314D] mt-0.5">{qCount} Qs</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[#647084]">Duration</div>
                          <div className="font-bold text-[#1F314D] mt-0.5">{duration}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[#647084]">Marks</div>
                          <div className="font-bold text-[#1F314D] mt-0.5">{marks}M</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5">
                      <Button
                        type="button"
                        onClick={() => handleSelectPaper(paper)}
                        className="w-full rounded-2xl bg-[#233249] hover:bg-[#1a2536] text-white text-xs font-bold h-10 group-hover:bg-[#0F7F8C] transition"
                      >
                        <span>Start Paper Practice</span>
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Analytics View */}
      {subTab === "analytics" && (
        <MasteryAnalytics onStartDrill={() => setSubTab("simulator")} />
      )}
    </div>
  );
}
