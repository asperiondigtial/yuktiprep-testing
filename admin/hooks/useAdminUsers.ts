import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";

export interface AdminUserListItem {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  role: string | null;
  active: boolean;
  examGroupId?: string | null;
  examOptionId?: string | null;
  examGroupName?: string | null;
  examOptionTitle?: string | null;
  locked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;
  lockReason: string | null;
  activeDeviceCount: number;
  createdAt: string;
}

export interface AdminUserDetail {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  role: string | null;
  active: boolean;
  examGroupId?: string | null;
  examOptionId?: string | null;
  examGroup?: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
  } | null;
  examOption?: {
    id: string;
    title: string;
    logoUrl?: string | null;
  } | null;
  locked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;
  lockedByAdmin: string | null;
  lockReason: string | null;
  createdAt: string;
  aiUsage?: {
    quota: {
      plan: string;
      dailyLimit: number;
      usedToday: number;
      remainingToday: number;
      allowed: boolean;
      resetsInSeconds: number;
    };
    totalRequests: number;
    totalTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalCostRupees: number;
  } | null;
  activeDeviceSessions: {
    id: string;
    deviceId: string;
    deviceName: string | null;
    deviceType: string | null;
    browser: string | null;
    operatingSystem: string | null;
    ipAddress: string | null;
    lastActiveAt: string;
    createdAt: string;
  }[];
}

export interface UserAccountActionItem {
  id: string;
  action: "LOCK" | "UNLOCK";
  adminId: string;
  adminName: string;
  adminEmail: string | null;
  reason: string | null;
  createdAt: string;
}

export function useAdminUsers(params?: { search?: string; status?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ["admin-users", params],
    queryFn: async () => {
      const res = await api.get("/api/v1/admin/users", { params });
      return res.data?.data || { users: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 1 } };
    },
  });
}

export function useAdminUserDetail(userId: string) {
  return useQuery({
    queryKey: ["admin-user", userId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/admin/users/${userId}`);
      return (res.data?.data as AdminUserDetail) || null;
    },
    enabled: Boolean(userId),
  });
}

export function useAdminUserAccountActions(userId: string) {
  return useQuery({
    queryKey: ["admin-user-actions", userId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/admin/users/${userId}/account-actions`);
      return (res.data?.data?.actions as UserAccountActionItem[]) || [];
    },
    enabled: Boolean(userId),
  });
}

export function useLockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const res = await api.post(`/api/v1/admin/users/${userId}/lock`, { reason });
      return res.data;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-actions", userId] });
    },
  });
}

export function useUnlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      const res = await api.post(`/api/v1/admin/users/${userId}/unlock`, { reason });
      return res.data;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-actions", userId] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await api.delete(`/api/v1/admin/users/${userId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

export function useAdminUserAiUsage(userId: string) {
  return useQuery({
    queryKey: ["admin-user-ai-usage", userId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/admin/ai-metering/users/${userId}`);
      return res.data?.data || null;
    },
    enabled: Boolean(userId),
  });
}
