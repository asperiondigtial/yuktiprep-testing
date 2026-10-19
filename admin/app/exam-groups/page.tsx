"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useAdminExamGroups,
  useCreateExamGroup,
  useUpdateExamGroup,
  useDeleteExamGroup,
  AdminExamGroup,
} from "@/hooks/useAdminExamCategories";
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Search,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function ExamGroupsAdminPage() {
  const { data: groups = [], isLoading } = useAdminExamGroups();
  const createMutation = useCreateExamGroup();
  const updateMutation = useUpdateExamGroup();
  const deleteMutation = useDeleteExamGroup();

  const [search, setSearch] = useState("");
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [activeGroup, setActiveGroup] = useState<AdminExamGroup | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState("");

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.slug.toLowerCase().includes(search.toLowerCase())
  );

  const openCreateModal = () => {
    setName("");
    setSlug("");
    setDescription("");
    setLogoUrl("");
    setSortOrder(groups.length + 1);
    setIsActive(true);
    setFormError("");
    setModalMode("create");
    setActiveGroup(null);
  };

  const openEditModal = (group: AdminExamGroup) => {
    setActiveGroup(group);
    setName(group.name);
    setSlug(group.slug);
    setDescription(group.description || "");
    setLogoUrl(group.logoUrl || "");
    setSortOrder(group.sortOrder);
    setIsActive(group.isActive);
    setFormError("");
    setModalMode("edit");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Name is required");
      return;
    }

    try {
      if (modalMode === "create") {
        await createMutation.mutateAsync({
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || null,
          logoUrl: logoUrl.trim() || null,
          sortOrder,
          isActive,
        });
      } else if (modalMode === "edit" && activeGroup) {
        await updateMutation.mutateAsync({
          id: activeGroup.id,
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || null,
          logoUrl: logoUrl.trim() || null,
          sortOrder,
          isActive,
        });
      }
      setModalMode(null);
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "Failed to save exam group");
    }
  };

  const handleDelete = async (group: AdminExamGroup) => {
    if (!confirm(`Are you sure you want to delete "${group.name}"? All options under this group will be deleted!`)) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(group.id);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to delete exam group");
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-[family-name:var(--font-poppins)]">
      {/* Header */}
      <div className="rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-50/80 via-emerald-50/40 to-teal-50/80 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-teal-800 font-semibold text-sm">
            <div className="h-8 w-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Layers className="h-4 w-4" />
            </div>
            <span>Registration & Onboarding Management</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Exam Categories (Groups)</h1>
          <p className="text-xs text-teal-900/70 mt-0.5">
            Manage the top-level exam categories (UPSC, SSC, Banking, etc.) shown to users upon signup.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-teal-700 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Create Exam Group
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search exam categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-2 text-xs text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white"
          />
        </div>
        <span className="text-xs text-gray-500 font-medium">
          {filteredGroups.length} Categories
        </span>
      </div>

      {/* Grid of Exam Groups */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center bg-white space-y-3">
          <Layers className="h-8 w-8 text-gray-400 mx-auto" />
          <p className="text-sm font-semibold text-gray-700">No exam categories found</p>
          <p className="text-xs text-gray-400">Click &ldquo;Create Exam Group&rdquo; to add your first category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredGroups.map((group) => (
            <div
              key={group.id}
              className={`rounded-2xl border bg-white p-5 shadow-xs transition-all flex flex-col justify-between space-y-4 hover:shadow-md hover:border-teal-200 ${
                group.isActive ? "border-gray-200" : "border-gray-200 bg-gray-50/50 opacity-75"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Logo or Fallback Initials */}
                  {group.logoUrl ? (
                    <img
                      src={group.logoUrl}
                      alt={group.name}
                      className="h-12 w-12 rounded-xl object-contain border border-gray-200 bg-white p-1"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center text-white font-bold text-lg shadow-xs">
                      {group.name.slice(0, 3).toUpperCase()}
                    </div>
                  )}

                  <div>
                    <h2 className="text-base font-bold text-gray-900 leading-snug">{group.name}</h2>
                    <span className="text-[11px] font-mono text-gray-400">/{group.slug}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {group.isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 border border-gray-200">
                      Inactive
                    </span>
                  )}
                </div>
              </div>

              {group.description && (
                <p className="text-xs text-gray-600 line-clamp-2">{group.description}</p>
              )}

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                <div className="text-gray-500">
                  <span className="font-semibold text-gray-900">{group._count?.examOptions || 0}</span> Exam Options
                  <span className="mx-2 text-gray-300">•</span>
                  Order: <span className="font-semibold text-gray-900">{group.sortOrder}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/exam-groups/${group.id}/options`}
                    className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1.5 font-semibold text-teal-700 hover:bg-teal-100 transition-colors"
                  >
                    Exams <ArrowRight className="h-3 w-3" />
                  </Link>

                  <button
                    onClick={() => openEditModal(group)}
                    className="p-1.5 text-gray-500 hover:text-teal-600 rounded-lg hover:bg-gray-100"
                    title="Edit"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={() => handleDelete(group)}
                    className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900">
              {modalMode === "create" ? "Create Exam Group" : "Edit Exam Group"}
            </h3>

            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., UPSC, SSC, Banking, Railways"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (modalMode === "create" && !slug) {
                      setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                    }
                  }}
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700">URL Slug (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., upsc, ssc"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Logo Image URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://... or leave empty to use category name initials"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
                <p className="text-[11px] text-gray-400">
                  If logo is not provided, the exam group name initials will be displayed dynamically as a logo badge.
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Description</label>
                <textarea
                  rows={2}
                  placeholder="Short summary for this category..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700">Sort Order</label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
                  />
                  <label htmlFor="isActive" className="font-semibold text-gray-700 select-none cursor-pointer">
                    Active in Onboarding
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="rounded-lg border border-gray-200 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                >
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
