"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  iconBg?: string;
  badge?: {
    text: string;
    variant?: "success" | "warning" | "danger" | "info" | "neutral" | "purple" | "emerald";
  };
  trend?: {
    value: string;
    isPositive?: boolean;
    text?: string;
  };
  href?: string;
  linkText?: string;
  isLoading?: boolean;
  className?: string;
  footer?: React.ReactNode;
  accentColor?: string;
}

export function KpiCard({
  title,
  value,
  subValue,
  icon,
  iconBg = "bg-teal-50 text-teal-600 border-teal-100",
  badge,
  trend,
  href,
  linkText = "View details",
  isLoading = false,
  className,
  footer,
}: KpiCardProps) {
  const getBadgeStyle = (variant = "neutral") => {
    switch (variant) {
      case "success":
      case "emerald":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "warning":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "danger":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "purple":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "info":
        return "bg-blue-50 text-blue-700 border-blue-200";
      default:
        return "bg-neutral-100 text-neutral-700 border-neutral-200";
    }
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-xs transition-all duration-200 hover:border-neutral-300 hover:shadow-md",
        className
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            {title}
          </span>
          {isLoading ? (
            <div className="h-8 w-24 animate-pulse rounded-md bg-neutral-200 mt-1" />
          ) : (
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold tracking-tight text-neutral-900">
                {value}
              </h3>
              {subValue && (
                <span className="text-xs font-medium text-neutral-500">
                  {subValue}
                </span>
              )}
            </div>
          )}
        </div>

        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-transform duration-200 group-hover:scale-105",
            iconBg
          )}
        >
          {icon}
        </div>
      </div>

      {/* Middle/Trend & Badge row */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {badge && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
              getBadgeStyle(badge.variant)
            )}
          >
            {badge.text}
          </span>
        )}

        {trend && (
          <div className="flex items-center gap-1 text-xs font-medium">
            {trend.isPositive ? (
              <span className="inline-flex items-center text-emerald-600 font-semibold">
                <ArrowUpRight className="h-3.5 w-3.5" />
                {trend.value}
              </span>
            ) : (
              <span className="inline-flex items-center text-rose-600 font-semibold">
                <ArrowDownRight className="h-3.5 w-3.5" />
                {trend.value}
              </span>
            )}
            {trend.text && (
              <span className="text-neutral-500">{trend.text}</span>
            )}
          </div>
        )}
      </div>

      {/* Custom footer or default navigation link */}
      {footer ? (
        <div className="mt-4 pt-3 border-t border-neutral-100">{footer}</div>
      ) : href ? (
        <div className="mt-4 pt-3 border-t border-neutral-100">
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-600 transition-colors hover:text-teal-700"
          >
            <span>{linkText}</span>
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
