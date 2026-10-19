"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useAdminUserDetail,
  useAdminUserAccountActions,
  useAdminUserAiUsage,
  useLockUser,
  useUnlockUser,
  useDeleteUser,
} from "@/hooks/useAdminUsers";
import {
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  Smartphone,
  History,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  User as UserIcon,
  Mail,
  Phone,
  Trash2,
  Cpu,
  Zap,
  TrendingUp,
} from "lucide-react";

export default function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const userId = resolvedParams.id;

  const { data: user, isLoading, isError } = useAdminUserDetail(userId);
  const { data: actions = [] } = useAdminUserAccountActions(userId);
  const { data: aiUsageData } = useAdminUserAiUsage(userId);

  const lockMutation = useLockUser();
  const unlockMutation = useUnlockUser();
  const deleteMutation = useDeleteUser();

  // Modals state
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockReason, setLockReason] = useState("");
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleConfirmLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockReason.trim()) return;

    try {
      await lockMutation.mutateAsync({ userId, reason: lockReason.trim() });
      setShowLockModal(false);
      setLockReason("");
      setNotification({
        type: "success",
        message: "User locked successfully. All active sessions have been revoked.",
      });
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err?.response?.data?.message || "Failed to lock user.",
      });
    }
  };

  const handleConfirmUnlock = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await unlockMutation.mutateAsync({ userId, reason: unlockReason.trim() || undefined });
      setShowUnlockModal(false);
      setUnlockReason("");
      setNotification({
        type: "success",
        message: "User restored successfully. The user can log in again.",
      });
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err?.response?.data?.message || "Failed to restore user.",
      });
    }
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirmationText.trim().toUpperCase() !== "DELETE") return;

    try {
      await deleteMutation.mutateAsync(userId);
      setShowDeleteModal(false);
      // Redirect back to user directory after deletion
      router.push("/users");
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err?.response?.data?.message || "Failed to delete user.",
      });
      setShowDeleteModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto font-[family-name:var(--font-poppins)]">
        <div className="h-6 w-32 bg-gray-200 animate-pulse rounded mb-4" />
        <div className="h-32 bg-gray-100 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="p-8 max-w-5xl mx-auto font-[family-name:var(--font-poppins)] space-y-4">
        <Link href="/users" className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700">
          <ArrowLeft className="h-4 w-4" /> Back to Users
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
          User could not be found or failed to load.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto font-[family-name:var(--font-poppins)]">
      {/* Top Nav Back */}
      <div className="flex items-center justify-between">
        <Link
          href="/users"
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to User Directory
        </Link>
      </div>

      {/* Toast Alert */}
      {notification && (
        <div
          className={`rounded-xl p-4 text-sm flex items-center justify-between border ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-semibold underline ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* User Header Profile Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-bold text-2xl shrink-0">
            {user.name ? user.name.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-gray-900">{user.name || "Unnamed Student"}</h1>
              {user.locked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 border border-red-200">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Locked
                </span>
              ) : user.active ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                  Inactive (Pending Exam Selection)
                </span>
              )}

              {user.examGroup && (
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800 border border-teal-200">
                  {user.examGroup.name} {user.examOption?.title ? `• ${user.examOption.title}` : ""}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 pt-1">
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5 text-gray-400" />
                {user.email || "No email"}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5 text-gray-400" />
                {user.phoneNumber || "No phone"}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                Joined {new Date(user.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {user.locked ? (
            <button
              onClick={() => setShowUnlockModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-teal-700 transition-all cursor-pointer"
            >
              <Unlock className="h-4 w-4" />
              Restore User
            </button>
          ) : (
            <button
              onClick={() => setShowLockModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-amber-700 transition-all cursor-pointer"
            >
              <Lock className="h-4 w-4" />
              Lock User
            </button>
          )}

          <button
            onClick={() => {
              setDeleteConfirmationText("");
              setShowDeleteModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 shadow-xs hover:bg-red-600 hover:text-white transition-all cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            Delete User
          </button>
        </div>
      </div>

      {/* Lock Information Card if Locked */}
      {user.locked && (
        <div className="rounded-xl border border-red-200 bg-red-50/70 p-5 space-y-3">
          <div className="flex items-center gap-2 text-red-900 font-semibold text-sm">
            <ShieldAlert className="h-4 w-4 text-red-600" />
            <span>Account Currently Locked</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg bg-white p-3 border border-red-100">
              <span className="text-gray-500 font-medium">Locked Date:</span>
              <div className="font-semibold text-gray-900 mt-1">
                {user.lockedAt ? new Date(user.lockedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "N/A"}
              </div>
            </div>
            <div className="rounded-lg bg-white p-3 border border-red-100">
              <span className="text-gray-500 font-medium">Locked By:</span>
              <div className="font-semibold text-gray-900 mt-1">
                {user.lockedByAdmin || user.lockedBy || "Administrator"}
              </div>
            </div>
            <div className="rounded-lg bg-white p-3 border border-red-100">
              <span className="text-gray-500 font-medium">Reason:</span>
              <div className="font-semibold text-red-800 mt-1">
                {user.lockReason || "No reason specified"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Device Sessions */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-teal-600" />
            <h2 className="text-base font-semibold text-gray-900">Active Device Sessions</h2>
          </div>
          <span className="text-xs font-semibold text-gray-500">
            {user.activeDeviceSessions?.length || 0} / 3 Active Devices
          </span>
        </div>

        {user.activeDeviceSessions?.length === 0 ? (
          <p className="text-xs text-gray-500 italic py-2">
            No active device sessions currently connected.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {user.activeDeviceSessions.map((s) => (
              <div key={s.id} className="rounded-lg border border-gray-200 bg-gray-50/60 p-3.5 space-y-1 text-xs">
                <div className="font-semibold text-gray-900 flex items-center justify-between">
                  <span>{s.deviceName || "Desktop Client"}</span>
                  <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-800">
                    {s.deviceType || "desktop"}
                  </span>
                </div>
                <div className="text-gray-500">
                  {s.browser || "Unknown"} on {s.operatingSystem || "Unknown"}
                </div>
                <div className="text-[11px] text-gray-400 pt-1">
                  Last active: {new Date(s.lastActiveAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Tutor & Token Usage Metering Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-gray-900">
              AI Metering & Token Consumption
            </h2>
          </div>
          {aiUsageData?.quota && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-semibold uppercase text-indigo-700">
              <Zap className="h-3.5 w-3.5 text-indigo-500 fill-indigo-500" />
              {aiUsageData.quota.plan} Tier • {aiUsageData.quota.dailyLimit}/day Quota
            </span>
          )}
        </div>

        {/* Quota Progress & Metric Stats */}
        {aiUsageData?.quota ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 space-y-2">
              <div className="text-xs font-medium text-gray-500">Today's Daily Quota</div>
              <div className="text-xl font-bold text-gray-900">
                {aiUsageData.quota.usedToday}{" "}
                <span className="text-xs font-normal text-gray-500">
                  / {aiUsageData.quota.dailyLimit} queries used
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${
                    aiUsageData.quota.usedToday >= aiUsageData.quota.dailyLimit
                      ? "bg-red-500"
                      : aiUsageData.quota.usedToday >= aiUsageData.quota.dailyLimit * 0.8
                      ? "bg-amber-500"
                      : "bg-teal-500"
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (aiUsageData.quota.usedToday /
                          Math.max(1, aiUsageData.quota.dailyLimit)) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>
              <div className="text-[11px] text-gray-400">
                {aiUsageData.quota.remainingToday} remaining today
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 space-y-1">
              <div className="text-xs font-medium text-gray-500">Total Tokens Consumed</div>
              <div className="text-xl font-bold text-gray-900">
                {(aiUsageData.totals?.totalTokens || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-gray-400">
                In: {(aiUsageData.totals?.totalPromptTokens || 0).toLocaleString()} • Out:{" "}
                {(aiUsageData.totals?.totalCompletionTokens || 0).toLocaleString()}
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 space-y-1">
              <div className="text-xs font-medium text-gray-500">Total AI Cost (Est.)</div>
              <div className="text-xl font-bold text-gray-900">
                ₹{aiUsageData.totals?.totalCostRupees || "0.0000"}
              </div>
              <div className="text-[11px] text-gray-400">
                Calculated on micro-rupee ledger
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 space-y-1">
              <div className="text-xs font-medium text-gray-500">Total API Requests</div>
              <div className="text-xl font-bold text-gray-900">
                {aiUsageData.totals?.totalRequests || 0}
              </div>
              <div className="text-[11px] text-gray-400">
                Settled AI Tutor & Study Plan queries
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-500 italic py-2">
            Loading real-time token metering data...
          </div>
        )}

        {/* Recent AI Query Logs */}
        {aiUsageData?.logs && aiUsageData.logs.length > 0 && (
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Recent AI Interactions (Latest 50)
            </h3>
            <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-medium">Timestamp</th>
                    <th className="px-3 py-2 font-medium">Feature</th>
                    <th className="px-3 py-2 font-medium">Prompt Tokens</th>
                    <th className="px-3 py-2 font-medium">Completion Tokens</th>
                    <th className="px-3 py-2 font-medium">Total Tokens</th>
                    <th className="px-3 py-2 font-medium">Est. Cost (₹)</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {aiUsageData.logs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900 capitalize">
                        {log.feature?.replace("_", " ")}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {log.promptTokens?.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {log.completionTokens?.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-semibold text-gray-800">
                        {log.totalTokens?.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        ₹{log.costRupees}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Account Action History (Audit Log) */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-teal-600" />
          <h2 className="text-base font-semibold text-gray-900">Account Action History (Audit Trail)</h2>
        </div>

        {actions.length === 0 ? (
          <p className="text-xs text-gray-500 italic py-2">
            No administrative lock/unlock actions recorded for this account.
          </p>
        ) : (
          <div className="space-y-3">
            {actions.map((act) => (
              <div
                key={act.id}
                className="flex items-start justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-3.5 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {act.action === "LOCK" ? (
                      <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 font-bold text-red-800">
                        <Lock className="h-3 w-3" /> LOCKED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">
                        <Unlock className="h-3 w-3" /> RESTORED
                      </span>
                    )}
                    <span className="font-semibold text-gray-700">By: {act.adminName}</span>
                  </div>
                  {act.reason && (
                    <p className="text-gray-600 font-medium pl-1">
                      Reason: <span className="font-normal text-gray-800">{act.reason}</span>
                    </p>
                  )}
                </div>
                <span className="text-[11px] text-gray-400 shrink-0">
                  {new Date(act.createdAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lock Confirmation Modal */}
      {showLockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4 border border-gray-100">
            <div className="flex items-center gap-3 text-red-600">
              <div className="rounded-full bg-red-100 p-2">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Lock User Account?</h3>
                <p className="text-xs text-gray-500">Target: {user.name || user.email}</p>
              </div>
            </div>

            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-800 space-y-1">
              <p className="font-semibold">This operation will atomically:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Prevent user from logging in via OTP</li>
                <li>Terminate all active device sessions immediately</li>
                <li>Invalidate existing refresh tokens</li>
                <li>Block ongoing protected API requests</li>
              </ul>
            </div>

            <form onSubmit={handleConfirmLock} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Reason for locking <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={lockReason}
                  onChange={(e) => setLockReason(e.target.value)}
                  placeholder="e.g., Suspicious multi-device login activity or security review"
                  className="w-full rounded-xl border border-gray-200 p-3 text-xs text-gray-900 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLockModal(false)}
                  disabled={lockMutation.isPending}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={lockMutation.isPending || !lockReason.trim()}
                  className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {lockMutation.isPending ? "Locking..." : "Confirm & Lock User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4 border border-gray-100">
            <div className="flex items-center gap-3 text-teal-600">
              <div className="rounded-full bg-teal-100 p-2">
                <Unlock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Restore User Account?</h3>
                <p className="text-xs text-gray-500">Target: {user.name || user.email}</p>
              </div>
            </div>

            <div className="rounded-lg bg-teal-50 p-3 text-xs text-teal-800 space-y-1">
              <p className="font-semibold">Security Notice:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Account will be unlocked to allow new sign-in</li>
                <li>Old revoked sessions remain terminated (user must sign in again)</li>
                <li>Audit action will be logged</li>
              </ul>
            </div>

            <form onSubmit={handleConfirmUnlock} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Reason for restoring (optional)
                </label>
                <textarea
                  rows={3}
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  placeholder="e.g., Identity verified and security review passed"
                  className="w-full rounded-xl border border-gray-200 p-3 text-xs text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUnlockModal(false)}
                  disabled={unlockMutation.isPending}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={unlockMutation.isPending}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                >
                  {unlockMutation.isPending ? "Restoring..." : "Confirm & Restore"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4 border border-red-200">
            <div className="flex items-center gap-3 text-red-600">
              <div className="rounded-full bg-red-100 p-2.5 shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Permanently Delete User?</h3>
                <p className="text-xs text-gray-500">
                  Target: {user.name || "User"} ({user.email || user.phoneNumber || userId})
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-red-50 p-4 text-xs text-red-800 space-y-2 border border-red-200">
              <p className="font-semibold text-red-900 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                This action is destructive, irreversible, and cascades immediately:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-red-700">
                <li>All active device sessions and refresh tokens will be destroyed.</li>
                <li>All user subscriptions and payment records will be purged.</li>
                <li>AI interview sessions, voice recordings, and AI tutor chats will be deleted.</li>
                <li>Learner profile, study plans, saved jobs, and language preferences will be deleted.</li>
                <li>Community posts, comments, likes, and test attempts will be removed.</li>
              </ul>
            </div>

            <form onSubmit={handleConfirmDelete} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">
                  Please type <span className="font-bold text-red-600">DELETE</span> to confirm:
                </label>
                <input
                  type="text"
                  required
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full rounded-xl border border-gray-300 p-3 text-xs text-gray-900 font-mono tracking-wider focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleteMutation.isPending}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    deleteMutation.isPending ||
                    deleteConfirmationText.trim().toUpperCase() !== "DELETE"
                  }
                  className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Permanently Delete User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

