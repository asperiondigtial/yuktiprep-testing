"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Languages,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  Globe2,
  Users,
  AlertTriangle,
  RotateCw,
} from "lucide-react";

type Language = {
  id: string;
  code: string;
  azureCode: string | null;
  englishName: string;
  nativeName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    userPreferences: number;
  };
};

type LanguageFormData = {
  code: string;
  azureCode: string;
  englishName: string;
  nativeName: string;
  isActive: boolean;
};

const emptyFormData: LanguageFormData = {
  code: "",
  azureCode: "",
  englishName: "",
  nativeName: "",
  isActive: true,
};

export default function AdminLanguagesPage() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState<Language | null>(null);
  const [formData, setFormData] = useState<LanguageFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete modal state
  const [deletingLanguage, setDeletingLanguage] = useState<Language | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchLanguages = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/v1/admin/languages");
      const raw = res.data?.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.languages)
        ? raw.languages
        : Array.isArray(res.data?.languages)
        ? res.data.languages
        : [];
      setLanguages(list);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load languages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLanguages();
  }, []);

  const openCreateModal = () => {
    setEditingLanguage(null);
    setFormData(emptyFormData);
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (lang: Language) => {
    setEditingLanguage(lang);
    setFormData({
      code: lang.code,
      azureCode: lang.azureCode || lang.code,
      englishName: lang.englishName,
      nativeName: lang.nativeName,
      isActive: lang.isActive,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);

    try {
      if (editingLanguage) {
        // Update
        const res = await api.put(`/api/v1/admin/languages/${editingLanguage.id}`, formData);
        const updated = res.data?.data?.language || res.data?.data || res.data?.language || formData;
        setLanguages((prev) =>
          prev.map((l) => (l.id === editingLanguage.id ? { ...l, ...updated } : l))
        );
        showSuccess(`Language "${formData.englishName}" updated successfully.`);
      } else {
        // Create
        const res = await api.post("/api/v1/admin/languages", formData);
        const created = res.data?.data?.language || res.data?.data || res.data?.language;
        if (created && created.id) {
          setLanguages((prev) => [...prev, { ...created, _count: { userPreferences: 0 } }]);
        } else {
          await fetchLanguages();
        }
        showSuccess(`Language "${formData.englishName}" added successfully.`);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(
        err.response?.data?.message || err.message || "Failed to save language"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (lang: Language) => {
    if (togglingId) return;
    const nextActive = !lang.isActive;
    setTogglingId(lang.id);

    // Optimistic UI update
    setLanguages((prev) =>
      prev.map((l) => (l.id === lang.id ? { ...l, isActive: nextActive } : l))
    );

    try {
      let res;
      try {
        res = await api.patch(`/api/v1/admin/languages/${lang.id}/toggle`);
      } catch (patchErr: any) {
        // Fallback to PUT if PATCH toggle endpoint isn't reached
        if (patchErr.response?.status === 404) {
          res = await api.put(`/api/v1/admin/languages/${lang.id}`, {
            isActive: nextActive,
          });
        } else {
          throw patchErr;
        }
      }

      const updated = res.data?.data?.language || res.data?.data;
      const actualActive = updated?.isActive !== undefined ? updated.isActive : nextActive;
      
      setLanguages((prev) =>
        prev.map((l) => (l.id === lang.id ? { ...l, isActive: actualActive } : l))
      );
      showSuccess(
        `Language "${lang.englishName}" is now ${actualActive ? "Active" : "Inactive"}.`
      );
    } catch (err: any) {
      // Revert optimistic update
      setLanguages((prev) =>
        prev.map((l) => (l.id === lang.id ? { ...l, isActive: lang.isActive } : l))
      );
      setError(
        err.response?.data?.message || err.message || "Failed to update language status"
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingLanguage) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/admin/languages/${deletingLanguage.id}`);
      setLanguages((prev) => prev.filter((l) => l.id !== deletingLanguage.id));
      setIsDeleteModalOpen(false);
      showSuccess(`Language "${deletingLanguage.englishName}" deleted successfully.`);
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || "Failed to delete language"
      );
      setIsDeleteModalOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  const filteredLanguages = languages.filter((l) => {
    const matchesSearch =
      l.englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.nativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.azureCode && l.azureCode.toLowerCase().includes(searchQuery.toLowerCase()));

    if (filterStatus === "active") return matchesSearch && l.isActive;
    if (filterStatus === "inactive") return matchesSearch && !l.isActive;
    return matchesSearch;
  });

  const totalLanguages = languages.length;
  const activeLanguages = languages.filter((l) => l.isActive).length;
  const totalUsersUsing = languages.reduce(
    (acc, cur) => acc + (cur._count?.userPreferences || 0),
    0
  );

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 bg-[#F8FAFC] min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-50 border border-teal-200 rounded-xl text-teal-600">
              <Languages className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
                Languages Management
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Configure application languages, Azure translation codes, and availability across student portals.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLanguages}
            disabled={loading}
            className="rounded-xl border-slate-200 text-slate-700 hover:bg-white"
          >
            <RotateCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={openCreateModal}
            className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-sm gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Language
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Languages
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Globe2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{totalLanguages}</span>
            <span className="text-xs text-slate-500">configured</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Languages
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-600">{activeLanguages}</span>
            <span className="text-xs text-slate-500">
              of {totalLanguages} available to learners
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Student Preferences
            </span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-purple-600">{totalUsersUsing}</span>
            <span className="text-xs text-slate-500">active user preferences</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError("")}
            className="text-red-500 hover:text-red-700 font-bold ml-4"
          >
            &times;
          </button>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage("")}
            className="text-emerald-500 hover:text-emerald-700 font-bold ml-4"
          >
            &times;
          </button>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name, code (e.g. 'ta', 'Tamil', 'தமிழ்')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setFilterStatus("all")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              filterStatus === "all"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All ({totalLanguages})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("active")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              filterStatus === "active"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Active ({activeLanguages})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("inactive")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              filterStatus === "inactive"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Inactive ({totalLanguages - activeLanguages})
          </button>
        </div>
      </div>

      {/* Languages Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RotateCw className="w-6 h-6 animate-spin text-teal-600" />
            <span className="text-sm font-medium">Loading languages...</span>
          </div>
        ) : filteredLanguages.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Globe2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <h3 className="text-base font-semibold text-slate-800">No languages found</h3>
            <p className="text-sm text-slate-400 mt-1">
              {searchQuery
                ? "Try searching with a different term"
                : "Get started by adding your first application language"}
            </p>
            {!searchQuery && (
              <Button
                onClick={openCreateModal}
                size="sm"
                className="mt-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white"
              >
                Add Language
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6">Language</th>
                  <th className="py-3.5 px-6">Native Script</th>
                  <th className="py-3.5 px-6">Code</th>
                  <th className="py-3.5 px-6">Azure Translation Code</th>
                  <th className="py-3.5 px-6">Active Users</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredLanguages.map((lang) => (
                  <tr
                    key={lang.id}
                    className="hover:bg-slate-50/60 transition group"
                  >
                    {/* Language Name */}
                    <td className="py-4 px-6 font-medium text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <span className="font-semibold text-slate-900">
                          {lang.englishName}
                        </span>
                        {lang.code === "en" && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            Default
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Native Script */}
                    <td className="py-4 px-6 font-medium text-teal-700">
                      {lang.nativeName}
                    </td>

                    {/* Code */}
                    <td className="py-4 px-6">
                      <code className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs font-mono text-slate-800 font-semibold">
                        {lang.code}
                      </code>
                    </td>

                    {/* Azure Code */}
                    <td className="py-4 px-6">
                      {lang.azureCode ? (
                        <code className="px-2.5 py-1 rounded-md bg-blue-50 border border-blue-100 text-xs font-mono text-blue-700">
                          {lang.azureCode}
                        </code>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Active Users */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium">
                          {lang._count?.userPreferences || 0}
                        </span>
                      </div>
                    </td>

                    {/* Status Toggle */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={lang.isActive}
                          disabled={togglingId === lang.id}
                          onClick={() => handleToggleStatus(lang)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${
                            lang.isActive ? "bg-emerald-500" : "bg-slate-300"
                          } ${togglingId === lang.id ? "opacity-70 cursor-wait" : ""}`}
                          title={`Click to set language ${lang.isActive ? "Inactive" : "Active"}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-flex h-5 w-5 items-center justify-center transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              lang.isActive ? "translate-x-5" : "translate-x-0"
                            }`}
                          >
                            {togglingId === lang.id ? (
                              <RotateCw className="w-3 h-3 text-slate-500 animate-spin" />
                            ) : null}
                          </span>
                        </button>
                        <span
                          className={`text-xs font-semibold select-none cursor-pointer ${
                            lang.isActive ? "text-emerald-700" : "text-slate-500"
                          }`}
                          onClick={() => handleToggleStatus(lang)}
                        >
                          {lang.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(lang)}
                          className="h-8 w-8 p-0 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                          title="Edit Language"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={lang.code === "en"}
                          onClick={() => {
                            setDeletingLanguage(lang);
                            setIsDeleteModalOpen(true);
                          }}
                          className="h-8 w-8 p-0 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent"
                          title={
                            lang.code === "en"
                              ? "Default language cannot be deleted"
                              : "Delete Language"
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl p-6">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Globe2 className="w-5 h-5 text-teal-600" />
                {editingLanguage ? "Edit Language" : "Add New Language"}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                {editingLanguage
                  ? "Update language details and translation configuration."
                  : "Add a new language script for application UI and AI translation."}
              </DialogDescription>
            </DialogHeader>

            {formError && (
              <div className="my-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="englishName" className="text-xs font-semibold text-slate-700">
                  English Name *
                </Label>
                <Input
                  id="englishName"
                  required
                  placeholder="e.g. Tamil, Telugu, Hindi"
                  value={formData.englishName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, englishName: e.target.value }))
                  }
                  className="rounded-xl border-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nativeName" className="text-xs font-semibold text-slate-700">
                  Native Name / Script *
                </Label>
                <Input
                  id="nativeName"
                  required
                  placeholder="e.g. தமிழ், తెలుగు, हिन्दी"
                  value={formData.nativeName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, nativeName: e.target.value }))
                  }
                  className="rounded-xl border-slate-200 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="code" className="text-xs font-semibold text-slate-700">
                    Language Code *
                  </Label>
                  <Input
                    id="code"
                    required
                    placeholder="e.g. ta, te, hi"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        code: e.target.value.toLowerCase().trim(),
                        azureCode: prev.azureCode ? prev.azureCode : e.target.value.toLowerCase().trim(),
                      }))
                    }
                    className="rounded-xl border-slate-200 font-mono"
                  />
                  <p className="text-[10px] text-slate-400">ISO 639-1 code</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="azureCode" className="text-xs font-semibold text-slate-700">
                    Azure AI Code
                  </Label>
                  <Input
                    id="azureCode"
                    placeholder="e.g. ta, te, hi"
                    value={formData.azureCode}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        azureCode: e.target.value.toLowerCase().trim(),
                      }))
                    }
                    className="rounded-xl border-slate-200 font-mono"
                  />
                  <p className="text-[10px] text-slate-400">For Azure Translator</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                <div>
                  <Label htmlFor="isActive" className="text-sm font-semibold text-slate-800 cursor-pointer">
                    Enable Language
                  </Label>
                  <p className="text-xs text-slate-500">
                    When active, learners can select this language in their portal.
                  </p>
                </div>
                <input
                  id="isActive"
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
                  }
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border-slate-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white gap-2"
              >
                {saving ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : editingLanguage ? (
                  "Update Language"
                ) : (
                  "Create Language"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              Delete Language
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 pt-1">
              Are you sure you want to delete{" "}
              <strong className="text-slate-800">
                {deletingLanguage?.englishName} ({deletingLanguage?.nativeName})
              </strong>
              ?
              {deletingLanguage?._count && deletingLanguage._count.userPreferences > 0 && (
                <span className="block mt-2 font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs">
                  ⚠️ Note: {deletingLanguage._count.userPreferences} user(s) currently have this set as their preferred language. We recommend deactivating it instead.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
              className="rounded-xl border-slate-200"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white gap-2"
            >
              {deleting ? "Deleting..." : "Delete Language"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
