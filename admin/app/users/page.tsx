"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import {
  Users,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  ChevronRight,
  Filter,
} from "lucide-react";

export default function UsersAdminPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "locked">("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useAdminUsers({
    search: debouncedSearch,
    status: statusFilter,
    page,
    limit: 20,
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(search);
    setPage(1);
  };

  const users = data?.users || [];
  const pagination = data?.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-[family-name:var(--font-poppins)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                User Management
              </h1>
              <p className="text-sm text-gray-500">
                View student accounts, manage device sessions, and handle account lock / restore.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
            Total Users: <strong className="ml-1 text-gray-900">{pagination.total}</strong>
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or phone number..."
              className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as "all" | "active" | "inactive" | "locked");
                  setPage(1);
                }}
                className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive (Pending Exam)</option>
                <option value="locked">Locked Only</option>
              </select>
            </div>

            <button
              type="submit"
              className="h-10 px-4 rounded-lg bg-[#0f172a] text-sm font-medium text-white hover:bg-[#1e293b] transition-colors"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/75 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Contact</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Selected Exam</th>
                <th className="py-3.5 px-4">Active Devices</th>
                <th className="py-3.5 px-4">Joined</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-gray-500">
                    Loading users...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-red-600">
                    Failed to load users. Please check backend connection.
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-gray-500">
                    No users found matching your search criteria.
                  </td>
                </tr>
              ) : (
                users.map((user: import("@/hooks/useAdminUsers").AdminUserListItem) => (
                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-900">
                        {user.name || "Unnamed User"}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">
                        {user.id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-gray-900">{user.email || "No email"}</div>
                      <div className="text-xs text-gray-500">{user.phoneNumber || "No phone"}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {user.locked ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 border border-red-200">
                          <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
                          Locked
                        </span>
                      ) : user.active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                          Inactive (Pending)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {user.examGroupName ? (
                        <div className="space-y-0.5">
                          <div className="font-medium text-xs text-gray-900">
                            {user.examGroupName}
                          </div>
                          {user.examOptionTitle && (
                            <div className="text-[11px] text-gray-500">
                              {user.examOptionTitle}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Not Selected</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700">
                        <Smartphone className="h-3.5 w-3.5 text-gray-400" />
                        {user.activeDeviceCount} / 3
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/users/${user.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        Manage
                        <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-4 py-3 text-xs text-gray-600">
            <div>
              Page {pagination.page} of {pagination.totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-gray-200 bg-white px-2.5 py-1 font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="rounded-md border border-gray-200 bg-white px-2.5 py-1 font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
