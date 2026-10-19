import { api } from "./api";

export interface ExamOption {
  id: string;
  title: string;
  logoUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ExamGroup {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  examOptions: ExamOption[];
}

export const examApi = {
  // Public/user: fetches active exam groups & their options
  getActiveExamGroups: async (): Promise<ExamGroup[]> => {
    const res = await api.get<{ success?: boolean; data?: ExamGroup[] } | ExamGroup[]>("/api/v1/exam-groups");
    if (Array.isArray(res)) return res;
    return res?.data || [];
  },

  // User: saves the selected group and exam, activating the account
  saveExamSelection: async (payload: { examGroupId: string; examOptionId: string }) => {
    const res = await api.post("/api/v1/users/me/exam-selection", payload);
    return res.data;
  },
};
