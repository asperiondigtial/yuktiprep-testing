"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  X,
  AlertCircle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  RotateCcw,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { toast as hotToast } from "react-hot-toast";

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface EligibilityData {
  subscriptionId: string;
  paymentId?: string;
  planName: string;
  amount: number;
  currency: string;
  paymentDate?: string;
  isEligible: boolean;
  daysRemaining?: number;
  reason?: string;
  existingRefund?: {
    id: string;
    status: string;
    reason: string;
    createdAt: string;
    adminNote?: string;
  } | null;
}

const COMMON_REASONS = [
  "Accidental purchase or wrong plan selected",
  "Features did not meet my expectations",
  "Found an alternative resource or institute",
  "Exam timeline or syllabus changed",
  "Technical issues while using the platform",
  "Other personal reasons",
];

export const RefundModal: React.FC<RefundModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<EligibilityData[]>([]);
  const [selectedSubId, setSelectedSubId] = useState<string>("");
  const [selectedReasonOption, setSelectedReasonOption] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");
  const [submittedRefund, setSubmittedRefund] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      fetchEligibility();
      setSubmittedRefund(null);
      setSelectedReasonOption("");
      setCustomReason("");
    }
  }, [isOpen]);

  const fetchEligibility = async () => {
    setLoading(true);
    try {
      const res = await api.get<{
        success: boolean;
        data: { subscriptions: EligibilityData[] };
      }>("/api/v1/refunds/eligibility");

      const rawSubs = res?.data?.subscriptions || [];
      // Only paid subscriptions are refundable - filter out Free Plan / ₹0 items
      const subs = rawSubs.filter(
        (s) => Number(s.amount) > 0 && !s.planName.toLowerCase().includes("free")
      );
      setItems(subs);

      // Select first eligible subscription by default, or first existing
      const firstEligible = subs.find((s) => s.isEligible);
      if (firstEligible) {
        setSelectedSubId(firstEligible.subscriptionId);
      } else if (subs.length > 0) {
        setSelectedSubId(subs[0].subscriptionId);
      }
    } catch (err: any) {
      console.error("Failed to load refund eligibility:", err?.message || err, err?.data || "");
      const msg = err?.data?.message || err?.message || "Failed to check refund eligibility";
      sonnerToast.error(msg);
      // Fallback: keep items empty so modal renders user-friendly message rather than crashing
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentSelection = items.find((s) => s.subscriptionId === selectedSubId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubId) {
      sonnerToast.error("Please select a subscription");
      return;
    }

    const finalReason =
      selectedReasonOption === "Other personal reasons" || !selectedReasonOption
        ? customReason.trim()
        : customReason.trim()
          ? `${selectedReasonOption}: ${customReason.trim()}`
          : selectedReasonOption;

    if (!finalReason || finalReason.length < 5) {
      sonnerToast.error("Please enter a clear reason for the refund request (min 5 characters)");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post<{ success: boolean; message: string; data: any }>(
        "/api/v1/refunds/request",
        {
          subscriptionId: selectedSubId,
          reason: finalReason,
        }
      );

      if (res.success) {
        setSubmittedRefund(res.data);
        sonnerToast.success("Refund request submitted successfully!");
        hotToast.success("Refund under review. Check your email for updates.");
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      const msg = err.message || "Failed to submit refund request";
      sonnerToast.error(msg);
      hotToast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-gradient-to-r from-red-50/60 to-orange-50/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Subscription Refund
              </h3>
              <p className="text-xs text-gray-500">
                7-Day Money-Back Guarantee Policy
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 text-sm text-gray-600 space-y-5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
              <p className="mt-3 text-xs text-gray-500">Checking subscription eligibility...</p>
            </div>
          ) : submittedRefund ? (
            /* Success confirmation state */
            <div className="py-6 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h4 className="text-lg font-bold text-gray-900">
                Refund Request Submitted
              </h4>
              <p className="text-sm text-gray-600 max-w-sm mx-auto">
                We have registered your refund request (ID: <span className="font-mono font-semibold text-gray-800">{submittedRefund.id?.slice(0, 8)}...</span>).
                A confirmation has been sent to your registered email.
              </p>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-left text-xs text-emerald-900 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
                  <ShieldCheck className="h-4 w-4" />
                  What happens next?
                </div>
                <p>1. Our team reviews your request within 24 to 48 hours.</p>
                <p>2. Once approved, the amount will be reversed via Razorpay to your original bank/UPI account in 5-7 working days.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full mt-4 rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition"
              >
                Close
              </button>
            </div>
          ) : items.length === 0 ? (
            /* No subscriptions found */
            <div className="py-10 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <AlertCircle className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-gray-800">No active or refundable subscription found.</p>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                You do not currently hold a paid plan that can be refunded.
              </p>
            </div>
          ) : (
            /* Form view */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Select Subscription */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Select Subscription Plan
                </label>
                <div className="space-y-2">
                  {items.map((sub) => {
                    const isSelected = selectedSubId === sub.subscriptionId;
                    return (
                      <div
                        key={sub.subscriptionId}
                        onClick={() => setSelectedSubId(sub.subscriptionId)}
                        className={`flex items-center justify-between rounded-xl border p-3.5 cursor-pointer transition ${isSelected
                            ? "border-red-500 bg-red-50/40 ring-1 ring-red-500"
                            : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{sub.planName}</span>
                            <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                              ₹{sub.amount}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {sub.paymentDate && (
                              <span>Purchased {new Date(sub.paymentDate).toLocaleDateString()} • </span>
                            )}
                            {sub.existingRefund ? (
                              <span className="font-medium text-orange-600">
                                Refund {sub.existingRefund.status}
                              </span>
                            ) : sub.isEligible ? (
                              <span className="font-medium text-emerald-600">
                                Eligible ({sub.daysRemaining} days left)
                              </span>
                            ) : (
                              <span className="font-medium text-red-600">{sub.reason}</span>
                            )}
                          </div>
                        </div>
                        <input
                          type="radio"
                          name="subSelection"
                          checked={isSelected}
                          onChange={() => setSelectedSubId(sub.subscriptionId)}
                          className="h-4 w-4 text-red-600 focus:ring-red-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status or Reason Form */}
              {currentSelection && currentSelection.existingRefund ? (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-orange-800 text-xs">
                    <AlertCircle className="h-4 w-4" />
                    Refund Request Already Submitted
                  </div>
                  <p className="text-xs text-orange-700">
                    Status: <strong className="uppercase">{currentSelection.existingRefund.status}</strong>
                  </p>
                  <p className="text-xs text-orange-700">
                    Reason: {currentSelection.existingRefund.reason}
                  </p>
                  {currentSelection.existingRefund.adminNote && (
                    <p className="text-xs text-orange-900 border-t border-orange-200 pt-1 mt-1 font-medium">
                      Admin Note: {currentSelection.existingRefund.adminNote}
                    </p>
                  )}
                </div>
              ) : currentSelection && !currentSelection.isEligible ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-red-800 text-xs">
                    <AlertCircle className="h-4 w-4" />
                    Not Eligible for Refund
                  </div>
                  <p className="text-xs text-red-700">
                    {currentSelection.reason || "The 7-day refund window for this plan has elapsed."}
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                      Reason for Cancellation
                    </label>
                    <select
                      value={selectedReasonOption}
                      onChange={(e) => setSelectedReasonOption(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    >
                      <option value="">Select a reason...</option>
                      {COMMON_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                      Additional Details / Feedback
                    </label>
                    <textarea
                      rows={3}
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Please let us know how we can improve or why you'd like a refund..."
                      className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting || !currentSelection?.isEligible}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {submitting ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Refund Request</span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
