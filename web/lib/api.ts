const BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function getAuthHeaders() {
  const headers: Record<string, string> = {};

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token") || getCookie("token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const lang = localStorage.getItem("yuktiprep_language");
    if (lang) {
      try {
        const langObj = JSON.parse(lang);
        if (langObj && langObj.code) {
          headers["x-language"] = langObj.code;
        }
      } catch (e) { }
    }
  }

  return headers;
}

let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

function subscribeTokenRefresh(cb: (token: string | null) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function tryRefreshToken(): Promise<string | null> {
  try {
    const storedRefreshToken =
      typeof window !== "undefined"
        ? localStorage.getItem("refresh_token")
        : null;

    const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refreshToken: storedRefreshToken || undefined,
      }),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json().catch(() => ({}));
    const newToken = data?.data?.token;
    const newRefreshToken = data?.data?.refreshToken;

    if (newToken && typeof window !== "undefined") {
      localStorage.setItem("token", newToken);
      if (newRefreshToken) {
        localStorage.setItem("refresh_token", newRefreshToken);
      }
      return newToken;
    }
    return null;
  } catch {
    return null;
  }
}

async function request(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<any> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = getAuthHeaders();

  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string> || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  // If account locked: immediately clear auth, don't attempt refresh loop
  if (data?.code === "ACCOUNT_LOCKED" && typeof window !== "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("yuktiprep_user");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("yuktiprep_token");
    document.cookie = "token=; path=/; max-age=0; SameSite=Lax";
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login?locked=true";
    }
    const lockError: any = new Error(data?.message || "Your account has been locked. Please contact support.");
    lockError.status = response.status;
    lockError.code = "ACCOUNT_LOCKED";
    lockError.data = data;
    throw lockError;
  }

  // If session revoked / logged in on another device: immediately clear auth
  if (data?.code === "SESSION_REVOKED" && typeof window !== "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("yuktiprep_user");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("yuktiprep_token");
    document.cookie = "token=; path=/; max-age=0; SameSite=Lax";
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login?session_revoked=true";
    }
    const sessionError: any = new Error(data?.message || "You have been logged out because your account was logged in on another device.");
    sessionError.status = response.status;
    sessionError.code = "SESSION_REVOKED";
    sessionError.data = data;
    throw sessionError;
  }

  // If 401 and not already refreshing / retrying / calling auth routes
  const isAuthRoute =
    endpoint.includes("/login") ||
    endpoint.includes("/register") ||
    endpoint.includes("/refresh");
  if (!response.ok) {
    const hasExistingToken =
      typeof window !== "undefined" &&
      (localStorage.getItem("token") || localStorage.getItem("refresh_token"));

    if (
      response.status === 401 &&
      !isRetry &&
      !isAuthRoute &&
      hasExistingToken &&
      typeof window !== "undefined"
    ) {
      if (!isRefreshing) {
        isRefreshing = true;
        const newToken = await tryRefreshToken();
        isRefreshing = false;
        onRefreshed(newToken);

        if (newToken) {
          return request(endpoint, options, true);
        }
      } else {
        // Wait for refresh to complete
        const retryPromise = new Promise((resolve, reject) => {
          subscribeTokenRefresh((token) => {
            if (token) {
              resolve(request(endpoint, options, true));
            } else {
              reject(new Error(data?.message || "Session expired"));
            }
          });
        });
        return retryPromise;
      }

      // If refresh failed
      localStorage.removeItem("token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("yuktiprep_user");
      if (!window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/register")) {
        window.location.href = "/login?expired=true";
      }
    }

    const error: any = new Error(data?.message || "Something went wrong");
    error.status = response.status;
    error.code = data?.code;
    error.data = data;
    error.errors = data?.errors || [];
    throw error;
  }

  return data;
}

export const api = {
  get: <T = any>(endpoint: string, options?: RequestInit): Promise<T> =>
    request(endpoint, options),
  post: <T = any>(endpoint: string, body?: unknown): Promise<T> =>
    request(endpoint, {
      method: "POST",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
  put: <T = any>(endpoint: string, body: unknown): Promise<T> =>
    request(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  patch: <T = any>(endpoint: string, body: unknown): Promise<T> =>
    request(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  delete: <T = any>(endpoint: string): Promise<T> =>
    request(endpoint, {
      method: "DELETE",
    }),
  upload: async (endpoint: string, formData: FormData) => {
    const url = `${BASE_URL}${endpoint}`;
    const headers = getAuthHeaders();

    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: {
        ...headers,
      },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = data?.message || "Upload failed";
      throw new Error(message);
    }

    return data;
  },
};
