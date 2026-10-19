import { api } from "./api";

export type LoginPayload = {
  phone: string;
  channel?: "email" | "sms";
};

export type VerifyLoginPayload = {
  phone: string;
  otp: string;
  deviceId?: string;
};

export type DeviceSession = {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  browser: string;
  operatingSystem: string;
  ipAddress?: string;
  lastActiveAt: string;
  createdAt: string;
  current: boolean;
};

export type DevicesResponse = {
  success: boolean;
  message: string;
  data: {
    devices: DeviceSession[];
  };
};

export type RegisterPayload = {
  phone: string;
  name: string;
  email: string;
  channel?: "email" | "sms";
};

export type VerifyRegisterPayload = {
  phone: string;
  otp: string;
  email: string;
  name: string;
  targetExamId?: string;
  attemptYear?: number;
  studyHoursPerDay?: number;
  preferredLanguage?: string;
};

export type AuthResponse = {
  success: boolean;
  message: string;
  data?: {
    token: string;
    refreshToken?: string;
    sessionId?: string;
    user: {
      id: string;
      phoneNumber: string;
      name?: string;
      isVerified: boolean;
      role?: string;
      language?: string;
      state?: string;
      difficulty?: string;
      timezone?: string;
      deliveryHour?: number;
      channels?: string[];
      active?: boolean;
      createdAt?: string;
      updatedAt?: string;
      learnerProfile?: {
        id: string;
        userId: string;
        targetExamId?: string;
        attemptYear?: number;
        studyHoursPerDay?: number;
        preferredLanguage?: string;
        createdAt?: string;
        updatedAt?: string;
      };
    };
  };
};

export const authApi = {
  requestLoginOTP: (payload: LoginPayload) =>
    api.post("/api/v1/auth/login/send-otp", payload),

  verifyLoginOTP: (payload: VerifyLoginPayload) =>
    api.post("/api/v1/auth/login/verify-otp", payload),

  refreshToken: () =>
    api.post("/api/v1/auth/refresh"),

  getDevices: (): Promise<DevicesResponse> =>
    api.get("/api/v1/auth/devices"),

  logoutDevice: (sessionId: string) =>
    api.delete(`/api/v1/auth/devices/${sessionId}`),

  logoutOtherDevices: () =>
    api.post("/api/v1/auth/devices/logout-others"),

  logoutAllDevices: () =>
    api.post("/api/v1/auth/devices/logout-all"),

  logout: () =>
    api.post("/api/v1/auth/logout"),

  requestRegisterOTP: (payload: RegisterPayload) =>
    api.post("/api/v1/auth/register/send-otp", payload),

  verifyRegisterOTP: (payload: VerifyRegisterPayload) =>
    api.post("/api/v1/auth/register/verify-otp", payload),
};
