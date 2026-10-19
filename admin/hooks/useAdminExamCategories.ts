import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";

export interface AdminExamGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    examOptions: number;
    users: number;
  };
}

export interface AdminExamOption {
  id: string;
  examGroupId: string;
  title: string;
  logoUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  examGroup?: {
    id: string;
    name: string;
    slug?: string;
  };
  _count?: {
    users: number;
  };
}

/* ========================================================
   EXAM GROUPS HOOKS
======================================================== */

export function useAdminExamGroups() {
  return useQuery({
    queryKey: ["admin-exam-groups"],
    queryFn: async () => {
      const res = await api.get("/api/v1/admin/exam-groups");
      return (res.data?.data as AdminExamGroup[]) || [];
    },
  });
}

export function useAdminExamGroupDetail(id: string) {
  return useQuery({
    queryKey: ["admin-exam-group", id],
    queryFn: async () => {
      const res = await api.get(`/api/v1/admin/exam-groups/${id}`);
      return res.data?.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateExamGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AdminExamGroup>) => {
      const res = await api.post("/api/v1/admin/exam-groups", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-exam-groups"] });
    },
  });
}

export function useUpdateExamGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<AdminExamGroup>) => {
      const res = await api.put(`/api/v1/admin/exam-groups/${id}`, payload);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-exam-groups"] });
      queryClient.invalidateQueries({ queryKey: ["admin-exam-group", id] });
    },
  });
}

export function useDeleteExamGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/v1/admin/exam-groups/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-exam-groups"] });
    },
  });
}

/* ========================================================
   EXAM OPTIONS HOOKS
======================================================== */

export function useAdminExamOptions(examGroupId?: string) {
  return useQuery({
    queryKey: ["admin-exam-options", examGroupId],
    queryFn: async () => {
      const params = examGroupId ? { examGroupId } : {};
      const res = await api.get("/api/v1/admin/exam-options", { params });
      return (res.data?.data as AdminExamOption[]) || [];
    },
  });
}

export function useCreateExamOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AdminExamOption>) => {
      const res = await api.post("/api/v1/admin/exam-options", payload);
      return res.data;
    },
    onSuccess: (_, { examGroupId }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-exam-options"] });
      queryClient.invalidateQueries({ queryKey: ["admin-exam-groups"] });
      if (examGroupId) {
        queryClient.invalidateQueries({ queryKey: ["admin-exam-group", examGroupId] });
      }
    },
  });
}

export function useUpdateExamOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<AdminExamOption>) => {
      const res = await api.put(`/api/v1/admin/exam-options/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-exam-options"] });
      queryClient.invalidateQueries({ queryKey: ["admin-exam-groups"] });
    },
  });
}

export function useDeleteExamOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/v1/admin/exam-options/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-exam-options"] });
      queryClient.invalidateQueries({ queryKey: ["admin-exam-groups"] });
    },
  });
}
