"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SidebarDemo from "@/components/sidebar-demo";
import AuthGuard from "@/components/auth-guard";
import { authApi, DeviceSession } from "@/lib/auth-api";
import { toast } from "sonner";
import {
  Laptop,
  Smartphone,
  Tablet,
  Globe,
  LogOut,
  ShieldCheck,
  RefreshCw,
  ShieldAlert,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DevicesSettingsPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const res = await authApi.getDevices();
      if (res?.data?.devices) {
        setDevices(res.data.devices);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load active devices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleLogoutDevice = async (sessionId: string, isCurrent: boolean) => {
    try {
      setActionLoading(sessionId);
      await authApi.logoutDevice(sessionId);
      toast.success("Device logged out successfully");
      if (isCurrent) {
        localStorage.removeItem("token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("yuktiprep_user");
        localStorage.removeItem("auth_token");
        localStorage.removeItem("yuktiprep_token");
        document.cookie = "token=; path=/; max-age=0; SameSite=Lax";
        window.location.href = "/login";
        return;
      }
      setDevices((prev) => prev.filter((d) => d.id !== sessionId));
    } catch (err: any) {
      toast.error(err.message || "Failed to logout device");
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogoutOthers = async () => {
    if (!confirm("Are you sure you want to log out of all other devices?")) return;

    try {
      setActionLoading("others");
      await authApi.logoutOtherDevices();
      toast.success("All other devices have been logged out");
      setDevices((prev) => prev.filter((d) => d.current));
    } catch (err: any) {
      toast.error(err.message || "Failed to logout other devices");
    } finally {
      setActionLoading(null);
    }
  };

  const getDeviceIcon = (type: string) => {
    const lower = (type || "").toLowerCase();
    if (lower === "mobile") return <Smartphone className="w-6 h-6 text-blue-600" />;
    if (lower === "tablet") return <Tablet className="w-6 h-6 text-purple-600" />;
    return <Laptop className="w-6 h-6 text-emerald-600" />;
  };

  const formatLastActive = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 2) return "Active right now";
      if (diffMins < 60) return `${diffMins} minutes ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays} days ago`;
      return date.toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Recently";
    }
  };

  const otherDevicesCount = devices.filter((d) => !d.current).length;

  return (
    <AuthGuard>
      <div className="flex flex-col flex-1 font-sans bg-neutral-50 min-h-screen">
        <SidebarDemo>
          <main className="flex flex-1 flex-col min-w-0 h-full overflow-y-auto rounded-tl-2xl border border-neutral-200 bg-white p-4 shadow-sm md:p-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-neutral-200 gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 transition hover:bg-neutral-100"
                    aria-label="Back"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h1 className="text-2xl font-bold text-gray-900">Your Active Device</h1>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    Single-Device Protection Active
                  </span>
                </div>
                <p className="text-sm text-neutral-500 mt-1 pl-12">
                  For your security, YuktiPrep allows 1 active device at a time. Signing in on a new device will automatically sign you out of this session.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchDevices}
                  disabled={loading}
                  className="flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>

                {otherDevicesCount > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleLogoutOthers}
                    disabled={actionLoading === "others"}
                    className="flex items-center gap-1.5"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout all other devices
                  </Button>
                )}
              </div>
            </div>

            {/* Security Banner */}
            <div className="mt-6 flex items-start gap-3.5 p-4.5 rounded-2xl bg-teal-50/70 border border-teal-200 text-teal-950">
              <ShieldAlert className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
              <div className="text-sm leading-relaxed">
                <span className="font-semibold text-teal-900">Single Active Device Protection:</span>{" "}
                Your account is restricted to one active session at a time to prevent unauthorized sharing and protect your test analytics. If you sign in on another phone, tablet, or browser, your previous session will be immediately disconnected.
              </div>
            </div>

            {/* Device list */}
            <div className="mt-6 space-y-4">
              {loading && devices.length === 0 ? (
                <div className="p-8 text-center text-neutral-400">Loading active session...</div>
              ) : devices.length === 0 ? (
                <div className="p-8 text-center text-neutral-500">No active devices found.</div>
              ) : (
                devices.map((device) => (
                  <div
                    key={device.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border transition-all ${
                      device.current
                        ? "border-emerald-300 bg-emerald-50/40 shadow-sm"
                        : "border-neutral-200 bg-white hover:border-neutral-300"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-white border border-neutral-200/80 shadow-xs rounded-xl shrink-0 mt-0.5">
                        {getDeviceIcon(device.deviceType)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 text-base">
                            {device.deviceName}
                          </span>
                          {device.current && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-600 text-white shadow-xs">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Current Active Device
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 mt-1.5">
                          <span>{device.browser}</span>
                          <span>•</span>
                          <span>{device.operatingSystem}</span>
                          {device.ipAddress && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Globe className="w-3 h-3" />
                                {device.ipAddress}
                              </span>
                            </>
                          )}
                        </div>

                        <p className="text-xs text-neutral-400 mt-1.5">
                          {device.current
                            ? "Active right now"
                            : `Last active: ${formatLastActive(device.lastActiveAt)}`}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 sm:mt-0 flex items-center justify-end">
                      <Button
                        variant={device.current ? "outline" : "ghost"}
                        size="sm"
                        className={`text-neutral-600 hover:text-red-600 hover:bg-red-50 flex items-center gap-1.5 rounded-xl ${
                          device.current ? "border-neutral-300" : ""
                        }`}
                        onClick={() => handleLogoutDevice(device.id, device.current)}
                        disabled={actionLoading === device.id}
                      >
                        <LogOut className="w-4 h-4" />
                        {device.current ? "Sign out" : "Log out"}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Security note */}
            <div className="mt-10 p-5 rounded-2xl bg-neutral-50 border border-neutral-200">
              <h3 className="text-sm font-semibold text-neutral-800">Security Tips</h3>
              <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
                If you suspect unauthorized access, click <strong>Sign out</strong> above to end this session and then sign back in using OTP verification.
              </p>
            </div>
          </main>
        </SidebarDemo>
      </div>
    </AuthGuard>
  );
}
