"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import {
  CreditCard,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  IndianRupee,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  User,
  Calendar,
  Layers,
  Copy,
  Check,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PaymentUser = {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
};

type PaymentPlan = {
  id: string;
  name: string;
  key: string;
  price: number;
  currency: string;
};

type PaymentSubscription = {
  id: string;
  razorpaySubscriptionId: string | null;
  status: string;
  currentStart: string | null;
  currentEnd: string | null;
};

type Payment = {
  id: string;
  userId: string;
  subscriptionId: string;
  planId: string;
  razorpayPaymentId: string | null;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  rawResponse?: any;
  createdAt: string;
  updatedAt: string;
  user: PaymentUser;
  plan: PaymentPlan;
  subscription: PaymentSubscription;
  refundRequests?: Array<{
    id: string;
    status: string;
    reason: string;
    amount: number;
    createdAt: string;
    razorpayRefundId?: string | null;
  }>;
};

type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  totalRevenue?: number;
};

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 15,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
    totalRevenue: 0,
  });

  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleGrantTrial = async (userId: string, userName?: string | null) => {
    if (!confirm(`Are you sure you want to grant a 7-day Premium Trial to ${userName || "this user"}?`)) {
      return;
    }
    try {
      setActionLoading(`trial-${userId}`);
      const res = await api.post("/api/v1/admin/subscriptions/grant-trial", {
        userId,
        days: 7,
      });
      if (res.data?.success) {
        setActionMessage({
          type: "success",
          text: `Successfully granted 7-day Premium trial to ${userName || "user"}!`,
        });
        fetchPayments(page, search, statusFilter);
      }
    } catch (err: any) {
      console.error("Failed to grant trial:", err);
      setActionMessage({
        type: "error",
        text: err?.response?.data?.message || err.message || "Failed to grant trial",
      });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  const handleRevokeToFree = async (userId: string, userName?: string | null) => {
    if (
      !confirm(
        `Are you sure you want to revoke all active plans and downgrade ${userName || "this user"} to the Free plan?`
      )
    ) {
      return;
    }
    try {
      setActionLoading(`free-${userId}`);
      const res = await api.post("/api/v1/admin/subscriptions/downgrade-free", {
        userId,
      });
      if (res.data?.success) {
        setActionMessage({
          type: "success",
          text: `Successfully downgraded ${userName || "user"} to Free plan.`,
        });
        fetchPayments(page, search, statusFilter);
      }
    } catch (err: any) {
      console.error("Failed to downgrade to free:", err);
      setActionMessage({
        type: "error",
        text: err?.response?.data?.message || err.message || "Failed to downgrade to Free plan",
      });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  const handleDirectRefund = async (paymentId: string, amount: number, customerName?: string | null) => {
    const isPaise = amount >= 1000 && amount % 100 === 0;
    const amountInRupees = isPaise ? amount / 100 : amount;

    const reason = prompt(
      `Issue refund of ₹${amountInRupees} to ${customerName || "customer"}?\n\nEnter reason for refund (optional):`,
      "Requested by customer / Admin discretion"
    );
    if (reason === null) return; // User cancelled prompt

    try {
      setActionLoading(`refund-${paymentId}`);
      const res = await api.post("/api/v1/refunds/admin/direct-refund", {
        paymentId,
        reason: reason.trim() || "Admin direct refund",
      });
      if (res.data?.success) {
        setActionMessage({
          type: "success",
          text: `Refund of ₹${amountInRupees} initiated successfully via Razorpay for ${customerName || "customer"}!`,
        });
        setSelectedPayment(null);
        fetchPayments(page, search, statusFilter);
      }
    } catch (err: any) {
      console.error("Failed to process refund:", err);
      setActionMessage({
        type: "error",
        text: err?.response?.data?.message || err.message || "Failed to process refund",
      });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionMessage(null), 6000);
    }
  };

  const fetchPayments = useCallback(async (targetPage = page, targetSearch = search, targetStatus = statusFilter) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: targetPage.toString(),
        limit: "15",
      });

      if (targetSearch.trim()) {
        params.append("search", targetSearch.trim());
      }
      if (targetStatus && targetStatus !== "ALL") {
        params.append("status", targetStatus);
      }

      const res = await api.get(`/api/v1/admin/payments?${params.toString()}`);
      if (res.data?.success) {
        setPayments(res.data.data || []);
        if (res.data.meta) {
          setPagination(res.data.meta);
        }
      }
      setError("");
    } catch (err: any) {
      console.error("Failed to load payments:", err);
      setError(err?.response?.data?.message || err.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchPayments(page, search, statusFilter);
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPayments(1, search, statusFilter);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatAmount = (amountInPaise: number, currency: string = "INR") => {
    // Razorpay amounts are typically stored in paise (100 paise = 1 INR)
    // If value is small (e.g. 199, 499), it might already be in rupees, but standard Razorpay is paise.
    // In our schema: plan.price is in Rupees (e.g. 199), and Razorpay payments usually come in paise (19900).
    const isPaise = amountInPaise >= 1000 && amountInPaise % 100 === 0;
    const value = isPaise ? amountInPaise / 100 : amountInPaise;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase();
    switch (s) {
      case "captured":
      case "success":
      case "paid":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case "pending":
      case "created":
      case "authorized":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <RotateCcw className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  const totalRevenueFormatted = () => {
    const rev = pagination.totalRevenue || 0;
    const isPaise = rev >= 1000 && rev % 100 === 0;
    const val = isPaise ? rev / 100 : rev;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-emerald-600" />
            Razorpay Payments
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Monitor and audit all transactions, Razorpay payment IDs, and customer subscriptions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPayments(page, search, statusFilter)}
            disabled={loading}
            className="flex items-center gap-1.5 text-neutral-700 bg-white shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-neutral-200 bg-white shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Total Transactions</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{pagination.total}</p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-xl border border-neutral-200 bg-white shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Total Volume / Revenue</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{totalRevenueFormatted()}</p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <IndianRupee className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-xl border border-neutral-200 bg-white shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Gateway Integration</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-sm font-semibold text-neutral-800">Razorpay Live</p>
            </div>
          </div>
          <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
            RZP
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl border border-neutral-200 bg-white shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Payment ID, User Name, Email, Phone, or Plan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-24 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-neutral-900"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-neutral-900 text-white text-xs font-medium rounded-md hover:bg-neutral-800 transition"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-200 rounded-lg p-1 text-xs">
            {["ALL", "captured", "pending", "failed"].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-md font-medium transition ${statusFilter === st
                  ? "bg-white text-neutral-900 shadow-sm font-semibold"
                  : "text-neutral-500 hover:text-neutral-900"
                  }`}
              >
                {st === "ALL" ? "All" : st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feedback Alert state */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
            actionMessage.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs font-semibold underline ml-4 hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Payments Table */}
      <div className="border border-neutral-200 rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50/80 border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Payment Details</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Plan</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Method</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading && payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-neutral-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                    Loading transactions...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-neutral-500">
                    No transactions found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50/50 transition">
                    {/* Payment Details */}
                    <td className="px-5 py-3.5">
                      <div className="font-mono text-xs font-semibold text-neutral-900 flex items-center gap-1.5">
                        {p.razorpayPaymentId || "N/A"}
                        {p.razorpayPaymentId && (
                          <button
                            onClick={() => handleCopy(p.razorpayPaymentId!, p.id)}
                            title="Copy Payment ID"
                            className="text-neutral-400 hover:text-neutral-700"
                          >
                            {copiedId === p.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                      {p.subscription?.razorpaySubscriptionId && (
                        <div className="text-[11px] font-mono text-neutral-400 mt-0.5 truncate max-w-[180px]" title={p.subscription.razorpaySubscriptionId}>
                          Sub: {p.subscription.razorpaySubscriptionId}
                        </div>
                      )}
                    </td>

                    {/* Customer */}
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-neutral-900">{p.user?.name || "Unknown"}</div>
                      <div className="text-xs text-neutral-500">{p.user?.email || "No email"}</div>
                      {p.user?.phoneNumber && (
                        <div className="text-[11px] text-neutral-400">{p.user.phoneNumber}</div>
                      )}
                    </td>

                    {/* Plan */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-800">
                        {p.plan?.name || "Plan"}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-neutral-900">
                        {formatAmount(p.amount, p.currency)}
                      </span>
                    </td>

                    {/* Method */}
                    <td className="px-5 py-3.5">
                      <span className="capitalize text-xs font-medium text-neutral-600 bg-neutral-50 px-2 py-0.5 rounded border border-neutral-200">
                        {p.method || "card/upi"}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">{getStatusBadge(p.status)}</td>

                    {/* Date */}
                    <td className="px-5 py-3.5 text-xs text-neutral-500 whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedPayment(p)}
                          className="h-8 px-2.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 text-xs gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Details
                        </Button>

                        {p.userId && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={actionLoading === `trial-${p.userId}`}
                              onClick={() => handleGrantTrial(p.userId, p.user?.name)}
                              title="Grant 7-Day Premium Trial"
                              className="h-8 px-2.5 text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 border-purple-200 gap-1 font-medium"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              {actionLoading === `trial-${p.userId}` ? "Granting..." : "7D Trial"}
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              disabled={actionLoading === `free-${p.userId}`}
                              onClick={() => handleRevokeToFree(p.userId, p.user?.name)}
                              title="Revoke and downgrade to Free plan"
                              className="h-8 px-2.5 text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200 gap-1 font-medium"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                              {actionLoading === `free-${p.userId}` ? "Revoking..." : "Revoke to Free"}
                            </Button>

                            {(() => {
                              const refundReq = p.refundRequests?.[0];
                              if (refundReq) {
                                return (
                                  <span
                                    title={`Refund ${refundReq.status.toLowerCase()}: ${refundReq.reason}`}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border ${
                                      refundReq.status === "PENDING"
                                        ? "bg-amber-50 text-amber-800 border-amber-300"
                                        : refundReq.status === "PROCESSED" || refundReq.status === "APPROVED"
                                        ? "bg-blue-50 text-blue-800 border-blue-300"
                                        : "bg-neutral-100 text-neutral-700 border-neutral-300"
                                    }`}
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    Refund {refundReq.status === "PENDING" ? "Requested" : refundReq.status}
                                  </span>
                                );
                              }

                              if (p.status === "captured") {
                                return (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={actionLoading === `refund-${p.id}`}
                                    onClick={() => handleDirectRefund(p.id, p.amount, p.user?.name)}
                                    title="Issue full refund via Razorpay"
                                    className="h-8 px-2.5 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-300 gap-1 font-medium"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    {actionLoading === `refund-${p.id}` ? "Refunding..." : "Refund"}
                                  </Button>
                                );
                              }

                              return null;
                            })()}
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

        {/* Pagination Bar */}
        <div className="p-4 border-t border-neutral-200 bg-neutral-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500">
          <div>
            Showing <span className="font-semibold text-neutral-800">{payments.length}</span> of{" "}
            <span className="font-semibold text-neutral-800">{pagination.total}</span> payments
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasPrevPage || loading}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="h-8 px-2.5 text-xs bg-white shadow-sm"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <span className="px-2 font-medium text-neutral-700">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasNextPage || loading}
              onClick={() => setPage((prev) => prev + 1)}
              className="h-8 px-2.5 text-xs bg-white shadow-sm"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Details & Raw Payload Dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={(open) => !open && setSelectedPayment(null)}>
        <DialogContent className="min-w-[50vw] max-w-[90vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Payment Details</span>
              <span className="mx-8">
                {selectedPayment && getStatusBadge(selectedPayment.status)}
              </span>
            </DialogTitle>
            <DialogDescription>
              Transaction ID: <span className="font-mono text-neutral-900">{selectedPayment?.id}</span>
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4 text-sm mt-3">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-neutral-50 border border-neutral-200">
                <div>
                  <p className="text-xs text-neutral-400 font-medium">Razorpay Payment ID</p>
                  <p className="font-mono font-semibold text-neutral-900 mt-0.5">
                    {selectedPayment.razorpayPaymentId || "None"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 font-medium">Amount</p>
                  <p className="font-semibold text-emerald-600 mt-0.5">
                    {formatAmount(selectedPayment.amount, selectedPayment.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 font-medium">Customer</p>
                  <p className="font-medium text-neutral-900 mt-0.5">{selectedPayment.user?.name || "N/A"}</p>
                  <p className="text-xs text-neutral-500">{selectedPayment.user?.email}</p>
                  <p className="text-xs text-neutral-500">{selectedPayment.user?.phoneNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 font-medium">Subscription</p>
                  <p className="font-mono text-xs text-neutral-900 mt-0.5">
                    {selectedPayment.subscription?.razorpaySubscriptionId || "None"}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Status: <span className="capitalize font-medium">{selectedPayment.subscription?.status}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 font-medium">Plan</p>
                  <p className="font-medium text-neutral-900 mt-0.5">{selectedPayment.plan?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 font-medium">Created At</p>
                  <p className="text-xs text-neutral-700 mt-0.5">
                    {new Date(selectedPayment.createdAt).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>

              {/* Admin Actions Bar in Dialog */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-neutral-100/70 border border-neutral-200">
                <div className="text-xs">
                  <span className="font-semibold text-neutral-800">Subscription Controls:</span>
                  <p className="text-neutral-500">Manage plan tier for {selectedPayment.user?.name || "this user"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionLoading === `trial-${selectedPayment.userId}`}
                    onClick={() => handleGrantTrial(selectedPayment.userId, selectedPayment.user?.name)}
                    className="h-8 px-3 text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 border-purple-200 gap-1.5 font-medium"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {actionLoading === `trial-${selectedPayment.userId}` ? "Granting..." : "Grant 7-Day Premium Trial"}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionLoading === `free-${selectedPayment.userId}`}
                    onClick={() => handleRevokeToFree(selectedPayment.userId, selectedPayment.user?.name)}
                    className="h-8 px-3 text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200 gap-1.5 font-medium"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {actionLoading === `free-${selectedPayment.userId}` ? "Revoking..." : "Revoke to Free Plan"}
                  </Button>

                  {(() => {
                    const refundReq = selectedPayment.refundRequests?.[0];
                    if (refundReq) {
                      return (
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                              refundReq.status === "PENDING"
                                ? "bg-amber-50 text-amber-800 border-amber-300"
                                : refundReq.status === "PROCESSED" || refundReq.status === "APPROVED"
                                ? "bg-blue-50 text-blue-800 border-blue-300"
                                : "bg-neutral-100 text-neutral-700 border-neutral-300"
                            }`}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Refund {refundReq.status === "PENDING" ? "Requested (Under Review)" : refundReq.status}
                          </span>
                        </div>
                      );
                    }

                    if (selectedPayment.status === "captured") {
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionLoading === `refund-${selectedPayment.id}`}
                          onClick={() => handleDirectRefund(selectedPayment.id, selectedPayment.amount, selectedPayment.user?.name)}
                          className="h-8 px-3 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-300 gap-1.5 font-medium"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          {actionLoading === `refund-${selectedPayment.id}` ? "Refunding..." : "Issue Full Refund"}
                        </Button>
                      );
                    }

                    return null;
                  })()}
                </div>
              </div>

              {/* Raw Razorpay Payload */}
              <div>
                <p className="text-xs font-semibold text-neutral-700 mb-1.5 uppercase tracking-wider">
                  Raw Razorpay Webhook / Response Payload
                </p>
                <pre className="p-3 bg-neutral-900 text-neutral-100 rounded-lg text-xs font-mono overflow-x-auto max-h-60">
                  {selectedPayment.rawResponse
                    ? JSON.stringify(selectedPayment.rawResponse, null, 2)
                    : "// No raw payload stored for this payment."}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
