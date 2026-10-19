"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  useAdminExamGroupDetail,
  useAdminExamOptions,
  useCreateExamOption,
  useUpdateExamOption,
  useDeleteExamOption,
  AdminExamOption,
} from "@/hooks/useAdminExamCategories";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Layers,
  Search,
  BookOpen,
  ArrowRight,
} from "lucide-react";

export default function ExamOptionsAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const examGroupId = resolvedParams.id;

  const { data: group, isLoading: groupLoading } = useAdminExamGroupDetail(examGroupId);
  const { data: options = [], isLoading: optionsLoading } = useAdminExamOptions(examGroupId);

  const createMutation = useCreateExamOption();
  const updateMutation = useUpdateExamOption();
  const deleteMutation = useDeleteExamOption();

  const [search, setSearch] = useState("");
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [activeOption, setActiveOption] = useState<AdminExamOption | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState("");

  const filteredOptions = options.filter((o) =>
    o.title.toLowerCase().includes(search.toLowerCase())
  );

  const openCreateModal = () => {
    setTitle("");
    setLogoUrl("");
    setSortOrder(options.length + 1);
    setIsActive(true);
    setFormError("");
    setModalMode("create");
    setActiveOption(null);
  };

  const openEditModal = (opt: AdminExamOption) => {
    setActiveOption(opt);
    setTitle(opt.title);
    setLogoUrl(opt.logoUrl || "");
    setSortOrder(opt.sortOrder);
    setIsActive(opt.isActive);
    setFormError("");
    setModalMode("edit");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError("Title is required");
      return;
    }

    try {
      if (modalMode === "create") {
        await createMutation.mutateAsync({
          examGroupId,
          title: title.trim(),
          logoUrl: logoUrl.trim() || null,
          sortOrder,
          isActive,
        });
      } else if (modalMode === "edit" && activeOption) {
        await updateMutation.mutateAsync({
          id: activeOption.id,
          title: title.trim(),
          logoUrl: logoUrl.trim() || null,
          sortOrder,
          isActive,
        });
      }
      setModalMode(null);
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "Failed to save exam option");
    }
  };

  const handleDelete = async (opt: AdminExamOption) => {
    if (!confirm(`Delete "${opt.title}"?`)) return;
    try {
      await deleteMutation.mutateAsync(opt.id);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to delete exam option");
    }
  };

  if (groupLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="h-6 w-32 bg-gray-200 animate-pulse rounded mb-4" />
        <div className="h-32 bg-gray-100 animate-pulse rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto font-[family-name:var(--font-poppins)]">
      {/* Back button */}
      <div>
        <Link
          href="/exam-groups"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Exam Categories
        </Link>
      </div>

      {/* Parent Group Banner */}
      <div className="rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-50/70 via-emerald-50/40 to-teal-50/70 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {group?.logoUrl ? (
            <img
              src={group.logoUrl}
              alt={group.name}
              className="h-14 w-14 rounded-2xl object-contain border border-teal-200 bg-white p-1 shadow-xs"
            />
          ) : (
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center text-white font-bold text-xl shadow-xs">
              {group?.name?.slice(0, 3).toUpperCase()}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{group?.name} Exam Options</h1>
              <span className="rounded-full bg-teal-100 text-teal-800 font-semibold px-2.5 py-0.5 text-xs border border-teal-300/80">
                Category
              </span>
            </div>
            <p className="text-xs text-teal-900/70 mt-1">
              Active exams displayed in Stage 2 when user selects this category.
            </p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-teal-700 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Add Exam to {group?.name}
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search exams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-2 text-xs text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white"
          />
        </div>
        <span className="text-xs text-gray-500 font-medium">
          {filteredOptions.length} Exams in this Category
        </span>
      </div>

      {/* Options List */}
      {optionsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : filteredOptions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center bg-white space-y-3">
          <BookOpen className="h-8 w-8 text-gray-400 mx-auto" />
          <p className="text-sm font-semibold text-gray-700">No exams created under {group?.name}</p>
          <p className="text-xs text-gray-400">Click &ldquo;Add Exam&rdquo; to add options for students to pick.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOptions.map((opt) => (
            <div
              key={opt.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs flex items-center justify-between gap-4 hover:border-teal-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                {opt.logoUrl ? (
                  <img
                    src={opt.logoUrl}
                    alt={opt.title}
                    className="h-10 w-10 rounded-xl object-contain border border-gray-200 bg-white p-1"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                    {group?.name?.slice(0, 3).toUpperCase()}
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{opt.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                    <span>Sort Order: {opt.sortOrder}</span>
                    <span>•</span>
                    <span className={opt.isActive ? "text-emerald-600 font-medium" : "text-gray-400"}>
                      {opt.isActive ? "Active in Onboarding" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(opt)}
                  className="p-1.5 text-gray-500 hover:text-teal-600 rounded-lg hover:bg-gray-100"
                  title="Edit"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(opt)}
                  className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900">
              {modalMode === "create" ? `Add Exam to ${group?.name}` : "Edit Exam"}
            </h3>

            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Exam Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Civil Services Examination (CSE)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Logo URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://... or leave empty to use category logo"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
                <p className="text-[11px] text-gray-400">
                  If logo is not provided, the exam group ({group?.name}) logo will be used automatically.
                </p>
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
                    id="optActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
                  />
                  <label htmlFor="optActive" className="font-semibold text-gray-700 select-none cursor-pointer">
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
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Exam"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
