const DEVICE_ID_KEY = "app_device_id";

/**
 * Returns a stable, persistent device ID for this browser client.
 * Uses crypto.randomUUID() if unavailable or newly generated.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") {
    return "server-side-client";
  }

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      deviceId = crypto.randomUUID();
    } else {
      // Fallback pseudo-UUID
      deviceId = "dev-" + Math.random().toString(36).substring(2, 15) + "-" + Date.now().toString(36);
    }

    try {
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    } catch (e) {
      console.warn("Unable to save deviceId to localStorage:", e);
    }
  }

  return deviceId;
}
