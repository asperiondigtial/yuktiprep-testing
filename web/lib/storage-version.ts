/**
 * App Storage Version Manager
 * When APP_STORAGE_VERSION is incremented, all localStorage, sessionStorage,
 * and browser CacheStorage are automatically purged on app launch.
 */

export const APP_STORAGE_VERSION = "1.0.1";
const VERSION_KEY = "yuktiprep_app_version";

export function checkAndPurgeOutdatedStorage() {
  if (typeof window === "undefined") return;

  try {
    const currentVersion = localStorage.getItem(VERSION_KEY);

    if (currentVersion !== APP_STORAGE_VERSION) {
      console.log(
        `[StorageVersion] Upgrading from ${currentVersion || "initial"} to ${APP_STORAGE_VERSION}. Purging outdated cache and storage.`
      );

      // 1. Clear localStorage & sessionStorage
      try {
        localStorage.clear();
      } catch (e) {
        console.warn("Could not clear localStorage:", e);
      }

      try {
        sessionStorage.clear();
      } catch (e) {
        console.warn("Could not clear sessionStorage:", e);
      }

      // 2. Clear CacheStorage (Service Worker / browser HTTP cache)
      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            caches.delete(key).catch(() => {});
          });
        });
      }

      // 3. Set the new version
      localStorage.setItem(VERSION_KEY, APP_STORAGE_VERSION);
    }
  } catch (err) {
    console.warn("[StorageVersion] Check failed:", err);
  }
}
