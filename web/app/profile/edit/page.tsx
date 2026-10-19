"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { api } from "@/lib/api";
import { examApi, ExamGroup } from "@/lib/exam-api";
import { ArrowLeft, Camera } from "lucide-react";
import { Poppins } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

export default function ProfileEditPage() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    language: "en",
    state: "",
    difficulty: "mixed",
    timezone: "Asia/Kolkata",
    deliveryHour: 7,
    examGroupId: "",
    examOptionId: "",
    learnerProfile: {
      targetExamId: "",
      attemptYear: "",
      studyHoursPerDay: "",
    },
  });
  const [examGroups, setExamGroups] = useState<ExamGroup[]>([]);
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [profilePicPreview, setProfilePicPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    examApi.getActiveExamGroups()
      .then((groups) => {
        if (Array.isArray(groups)) {
          setExamGroups(groups);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (user && !initialized) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        language: user.language || "en",
        state: user.state || "",
        difficulty: user.difficulty || "mixed",
        timezone: user.timezone || "Asia/Kolkata",
        deliveryHour: user.deliveryHour || 7,
        examGroupId: user.examGroupId || "",
        examOptionId: user.examOptionId || "",
        learnerProfile: {
          targetExamId: user.learnerProfile?.targetExamId || "",
          attemptYear: user.learnerProfile?.attemptYear?.toString() || "",
          studyHoursPerDay: user.learnerProfile?.studyHoursPerDay?.toString() || "",
        },
      });
      if (user.profilePic) {
        setProfilePicPreview(user.profilePic);
      }
      setInitialized(true);
    }
  }, [user, initialized]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "examGroupId") {
      setFormData((prev) => ({ ...prev, examGroupId: value, examOptionId: "" }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleLearnerProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      learnerProfile: {
        ...prev.learnerProfile,
        [name]: value,
      },
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePicFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.put("/api/v1/profile", formData);
      updateUser(res.data.user);

      if (profilePicFile) {
        setUploading(true);
        const formData = new FormData();
        formData.append("file", profilePicFile);
        const uploadRes = await api.upload("/api/v1/profile/photo", formData);
        updateUser(uploadRes.data.user);
        setUploading(false);
      }

      router.push("/profile");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      setError(message);
      setUploading(false);
    } finally {
      setLoading(false);
    }
  };

  const inputStyles =
    "w-full rounded-xl border border-[#E2E6EE] bg-[#FAFBFC] px-4 py-3 text-sm font-medium text-[#1F314D] outline-none transition placeholder:text-[#647084] focus:border-[#087E8B]";

  const disabledInputStyles =
    "w-full rounded-xl border border-[#E2E6EE] bg-[#F1F3F7] px-4 py-3 text-sm font-medium text-[#7E8B9B] cursor-not-allowed select-none outline-none";

  return (
    <main
      className={`${poppins.variable} flex flex-1 flex-col min-w-0 h-full overflow-y-auto rounded-tl-2xl border border-neutral-200 bg-[#F4F6FA] p-5 shadow-sm md:p-8 lg:p-10 font-poppins`}
    >
      <div className="mx-auto w-full max-w-[600px]">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#1F314D] transition hover:bg-gray-100"
            aria-label={t("back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-[28px] font-semibold text-[#1F314D] md:text-[32px]">
            {t("editProfile")}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="flex h-[96px] w-[96px] items-center justify-center overflow-hidden rounded-full bg-[#F3F0FF]">
                {profilePicPreview ? (
                  <img
                    src={profilePicPreview}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-[#6B55D9]">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                )}
              </div>
              <label
                htmlFor="profile-photo"
                className="absolute -right-1 -bottom-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#6B55D9] text-white shadow-sm"
              >
                <Camera className="h-4 w-4" />
                <input
                  id="profile-photo"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-[#647084]">
              {t("clickCameraToUpload")}
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-semibold text-[#1F314D]">
                {t("fullName")} *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder={t("enterFullName")}
                className={inputStyles}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="email" className="text-sm font-semibold text-[#1F314D]">
                  {t("email")}
                </label>
                <span className="text-xs font-medium text-[#8F9BB3]">Cannot be changed</span>
              </div>
              <input
                id="email"
                name="email"
                type="email"
                disabled
                readOnly
                value={formData.email}
                placeholder={t("enterEmail")}
                className={disabledInputStyles}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="phoneNumber" className="text-sm font-semibold text-[#1F314D]">
                  {t("phoneNumber")}
                </label>
                <span className="text-xs font-medium text-[#8F9BB3]">Cannot be changed</span>
              </div>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                disabled
                readOnly
                value={formData.phoneNumber}
                placeholder={t("enterPhoneNumber")}
                className={disabledInputStyles}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="state" className="text-sm font-semibold text-[#1F314D]">
                {t("state")}
              </label>
              <select
                id="state"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className={inputStyles}
              >
                <option value="">Select State / Union Territory</option>
                {INDIAN_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="language" className="text-sm font-semibold text-[#1F314D]">
                  {t("languageField")}
                </label>
                <select
                  id="language"
                  name="language"
                  value={formData.language}
                  onChange={handleChange}
                  className={inputStyles}
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="ta">Tamil</option>
                  <option value="te">Telugu</option>
                  <option value="bn">Bengali</option>
                  <option value="mr">Marathi</option>
                  <option value="gu">Gujarati</option>
                  <option value="kn">Kannada</option>
                  <option value="ml">Malayalam</option>
                  <option value="pa">Punjabi</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="difficulty" className="text-sm font-semibold text-[#1F314D]">
                  {t("difficulty")}
                </label>
                <select
                  id="difficulty"
                  name="difficulty"
                  value={formData.difficulty}
                  onChange={handleChange}
                  className={inputStyles}
                >
                  <option value="easy">{t("easy")}</option>
                  <option value="medium">{t("medium")}</option>
                  <option value="hard">{t("hard")}</option>
                  <option value="mixed">{t("mixed")}</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="timezone" className="text-sm font-semibold text-[#1F314D]">
                {t("timezone")}
              </label>
              <select
                id="timezone"
                name="timezone"
                value={formData.timezone}
                onChange={handleChange}
                className={inputStyles}
              >
                <option value="Asia/Kolkata">India (Kolkata)</option>
                <option value="Asia/Mumbai">India (Mumbai)</option>
                <option value="Asia/Delhi">India (Delhi)</option>
                <option value="Asia/Chennai">India (Chennai)</option>
                <option value="Asia/Bangalore">India (Bangalore)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="deliveryHour" className="text-sm font-semibold text-[#1F314D]">
                {t("dailyReminderHour")}
              </label>
              <input
                id="deliveryHour"
                name="deliveryHour"
                type="number"
                min="0"
                max="23"
                value={formData.deliveryHour}
                onChange={handleChange}
                className={inputStyles}
              />
            </div>

            {/* Learner Profile Fields */}
            <div className="pt-6 mt-6 border-t border-[#E2E6EE]">
              <h3 className="text-lg font-semibold text-[#1F314D] mb-4">{t("learnerProfile")}</h3>

              {/* Notice about target exam changes */}
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs text-amber-800 flex items-start gap-2.5">
                <span className="text-sm leading-none mt-0.5">🔒</span>
                <div>
                  <p className="font-semibold text-amber-900">Target exam can only be changed by Admin</p>
                  <p className="mt-0.5 text-amber-700">
                    To change your target exam group or option, please{" "}
                    <a href="https://yuktiprep.com/contact" className="font-semibold text-amber-900 underline hover:text-amber-950">
                      contact support
                    </a>
                    .
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Exam Group Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="examGroupId" className="text-sm font-semibold text-[#1F314D]">
                      Exam Category / Group
                    </label>
                    <span className="text-xs font-medium text-[#8F9BB3]">Admin only</span>
                  </div>
                  <select
                    id="examGroupId"
                    name="examGroupId"
                    value={formData.examGroupId}
                    disabled
                    className={disabledInputStyles}
                  >
                    <option value="">Select Exam Category</option>
                    {examGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Exam Option Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="examOptionId" className="text-sm font-semibold text-[#1F314D]">
                      Target Exam Option
                    </label>
                    <span className="text-xs font-medium text-[#8F9BB3]">Admin only</span>
                  </div>
                  <select
                    id="examOptionId"
                    name="examOptionId"
                    value={formData.examOptionId}
                    disabled
                    className={disabledInputStyles}
                  >
                    <option value="">
                      {formData.examGroupId ? "Select Exam Option" : "No exam category selected"}
                    </option>
                    {(
                      examGroups.find((g) => g.id === formData.examGroupId)?.examOptions || []
                    ).map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="attemptYear" className="text-sm font-semibold text-[#1F314D]">
                      {t("attemptYear")}
                    </label>
                    <input
                      id="attemptYear"
                      name="attemptYear"
                      type="number"
                      min="2024"
                      max="2030"
                      value={formData.learnerProfile.attemptYear}
                      onChange={handleLearnerProfileChange}
                      placeholder="e.g. 2025"
                      className={inputStyles}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="studyHoursPerDay" className="text-sm font-semibold text-[#1F314D]">
                      {t("studyHours")}
                    </label>
                    <input
                      id="studyHoursPerDay"
                      name="studyHoursPerDay"
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={formData.learnerProfile.studyHoursPerDay}
                      onChange={handleLearnerProfileChange}
                      placeholder="e.g. 4.5"
                      className={inputStyles}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 rounded-xl border border-[#E2E6EE] bg-white py-3 text-sm font-semibold text-[#1F314D] transition hover:bg-gray-50"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={loading || uploading}
              className="flex-1 rounded-xl bg-[#6B55D9] py-3 text-sm font-semibold text-white transition hover:bg-[#5a48c4] disabled:opacity-50"
            >
              {loading || uploading ? t("saving") : t("saveChanges")}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}