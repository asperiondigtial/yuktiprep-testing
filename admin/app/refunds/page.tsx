"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import {
  RotateCcw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  IndianRupee,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  X,
  User,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type RefundRequest = {
  id: string;
  userId: string;
  subscriptionId: string;
  paymentId: string;
  amount: number;
  currency: string;
  reason: string;
  adminNote: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PROCESSED" | "FAILED";
  razorpayRefundId: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    phoneNumber: string | null;
  };
  subscription?: {
    plan?: {
      id: string;
      name: string;
      key: string;
    };
  };
  payment?: {
    id: string;
    razorpayPaymentId: string | null;
    amount: number;
    currency: string;
    method: string | null;
  };
};

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchRefunds = useCallback(
    async (targetPage = page, targetSearch = search, targetStatus = statusFilter) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: targetPage.toString(),
          limit: "20",
        });

        if (targetSearch.trim()) {
          params.append("search", targetSearch.trim());
        }
        if (targetStatus && targetStatus !== "ALL") {
          params.append("status", targetStatus);
        }

        const res = await api.get(`/api/v1/refunds/admin?${params.toString()}`);
        if (res.data?.success) {
          setRefunds(res.data.data || []);
          if (res.data.meta) {
            setPagination(res.data.meta);
          }
        }
        setError("");
      } catch (err: any) {
        console.error("Failed to load refunds:", err);
        setError(err?.response?.data?.message || err.message || "Failed to load refund requests");
      } finally {
        setLoading(false);
      }
    },
    [page, search, statusFilter]
  );

  useEffect(() => {
    fetchRefunds(page, search, statusFilter);
  }, [page, statusFilter]);

  const handleProcessRefund = async (
    refundId: string,
    status: "APPROVED" | "REJECTED" | "MANUAL_PROCESSED"
  ) => {
    let promptTitle = "";
    let defaultNote = "";

    if (status === "APPROVED") {
      promptTitle = "Approve and execute automated refund via Razorpay?\nEnter admin notes (optional):";
      defaultNote = "Approved by admin";
    } else if (status === "MANUAL_PROCESSED") {
      promptTitle = "Mark as Manually Refunded (UPI/offline/test settlement)?\nEnter transaction reference or notes:";
      defaultNote = "Refund settled manually / offline";
    } else {
      promptTitle = "Reject this refund request?\nEnter reason for rejection:";
      defaultNote = "Does not meet refund policy criteria";
    }

    const adminNote = prompt(promptTitle, defaultNote);
    if (adminNote === null) return;

    try {
      setActionLoading(`${status}-${refundId}`);
      const res = await api.patch(`/api/v1/refunds/admin/${refundId}/process`, {
        status,
        adminNote: adminNote.trim(),
      });

      if (res.data?.success) {
        setActionMessage({
          type: "success",
          text:
            status === "MANUAL_PROCESSED"
              ? "Refund marked as manually processed successfully!"
              : `Refund request successfully ${status.toLowerCase()}!`,
        });
        setSelectedRefund(null);
        fetchRefunds(page, search, statusFilter);
      }
    } catch (err: any) {
      console.error(`Failed to process refund:`, err);
      setActionMessage({
        type: "error",
        text: err?.response?.data?.message || err.message || "Failed to process refund",
      });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionMessage(null), 6000);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PROCESSED":
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            PENDING REVIEW
          </span>
        );
      case "REJECTED":
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
            {status}
          </span>
        );
    }
  };

  const formatAmount = (amount: number, currency: string = "INR") => {
    const isPaise = amount >= 1000 && amount % 100 === 0;
    const value = isPaise ? amount / 100 : amount;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 tracking-tight flex items-center gap-2.5">
            <RotateCcw className="w-7 h-7 text-amber-600" />
            Refund Requests
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Review user refund requests and process Razorpay reversals
          </p>
        </div>
      </div>

      {/* Action Messages */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
            actionMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-600" />
            )}
            <span className="text-sm font-medium">{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-neutral-400 hover:text-neutral-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            fetchRefunds(1, search, statusFilter);
          }}
          className="relative flex-1"
        >
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by User, Email or Razorpay Refund ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
          />
        </form>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-neutral-400 ml-1" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter refund requests by status"
            className="px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-700 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="PROCESSED">Processed / Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRefunds(page, search, statusFilter)}
            disabled={loading}
            className="h-9 px-3 gap-1.5 text-neutral-600 hover:text-neutral-900"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Refunds Table */}
      <div className="border border-neutral-200 rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50/80 border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Plan / Payment</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Reason</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Requested At</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading && refunds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-neutral-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-600 mb-2" />
                    Loading refund requests...
                  </td>
                </tr>
              ) : refunds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-neutral-500">
                    No refund requests found.
                  </td>
                </tr>
              ) : (
                refunds.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50/50 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-neutral-900">{r.user?.name || "Unknown"}</div>
                      <div className="text-xs text-neutral-500">{r.user?.email || "No email"}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-xs font-semibold text-neutral-900">
                        {r.subscription?.plan?.name || "Subscription"}
                      </div>
                      <div className="text-[11px] font-mono text-neutral-400 truncate max-w-[150px]">
                        {r.payment?.razorpayPaymentId || r.paymentId}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-neutral-900">
                        {formatAmount(r.amount, r.currency)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 max-w-xs">
                      <p className="text-xs text-neutral-700 truncate" title={r.reason}>
                        {r.reason}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">{getStatusBadge(r.status)}</td>
                    <td className="px-5 py-3.5 text-xs text-neutral-500 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRefund(r)}
                          className="h-8 px-2.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 text-xs gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Details
                        </Button>
                        {r.status === "PENDING" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={Boolean(actionLoading)}
                              onClick={() => handleProcessRefund(r.id, "APPROVED")}
                              className="h-8 px-2.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-300 gap-1 font-medium"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={Boolean(actionLoading)}
                              onClick={() => handleProcessRefund(r.id, "REJECTED")}
                              className="h-8 px-2.5 text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200 gap-1 font-medium"
                            >
                              <X className="w-3.5 h-3.5" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-500 bg-neutral-50/50">
            <span>
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                className="h-8 px-2 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((prev) => prev + 1)}
                className="h-8 px-2 text-xs"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Details Dialog */}
      <Dialog open={Boolean(selectedRefund)} onOpenChange={(open) => !open && setSelectedRefund(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-600" />
              Refund Request Details
            </DialogTitle>
            <DialogDescription>
              Review user request and take administrative action
            </DialogDescription>
          </DialogHeader>

          {selectedRefund && (
            <div className="space-y-4 pt-2 text-sm">
              <div className="bg-neutral-50 p-3.5 rounded-lg border border-neutral-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-neutral-500">Customer</span>
                  <span className="font-semibold text-neutral-900">{selectedRefund.user?.name || "User"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-neutral-500">Email</span>
                  <span className="font-mono text-xs text-neutral-700">{selectedRefund.user?.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-neutral-500">Amount</span>
                  <span className="font-bold text-neutral-900">
                    {formatAmount(selectedRefund.amount, selectedRefund.currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-neutral-500">Status</span>
                  <span>{getStatusBadge(selectedRefund.status)}</span>
                </div>
                {selectedRefund.razorpayRefundId && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-neutral-500">Razorpay Refund ID</span>
                    <span className="font-mono text-xs text-emerald-700 font-semibold">
                      {selectedRefund.razorpayRefundId}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-neutral-700 mb-1">User's Stated Reason:</p>
                <p className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-neutral-800 text-xs leading-relaxed">
                  {selectedRefund.reason}
                </p>
              </div>

              {selectedRefund.adminNote && (
                <div>
                  <p className="text-xs font-semibold text-neutral-700 mb-1">Admin Note:</p>
                  <p className="p-3 bg-amber-50/50 rounded-lg border border-amber-200 text-neutral-800 text-xs">
                    {selectedRefund.adminNote}
                  </p>
                </div>
              )}

              {selectedRefund.status === "PENDING" && (
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                  <Button
                    variant="outline"
                    disabled={Boolean(actionLoading)}
                    onClick={() => handleProcessRefund(selectedRefund.id, "REJECTED")}
                    className="text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200"
                  >
                    Reject Request
                  </Button>
                  <Button
                    variant="outline"
                    disabled={Boolean(actionLoading)}
                    onClick={() => handleProcessRefund(selectedRefund.id, "MANUAL_PROCESSED")}
                    className="text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200"
                    title="Mark as settled manually (UPI/bank transfer or test mode settlement)"
                  >
                    Mark as Settled Manually
                  </Button>
                  <Button
                    disabled={Boolean(actionLoading)}
                    onClick={() => handleProcessRefund(selectedRefund.id, "APPROVED")}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Approve via Razorpay
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
