"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAdminLogin } from "../../hooks/useAdminAuth";
import { Mail, Lock, Eye, EyeOff, ShieldCheck, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const loginMutation = useAdminLogin();

  useEffect(() => {
    if (searchParams.get("expired") === "true") {
      setSessionExpired(true);
      // Clean up the URL without triggering a page reload
      router.replace("/login");
    }
  }, [searchParams, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { email, password },
      {
        onSuccess: () => {
          router.push("/");
        },
      }
    );
  };

  return (
    <div className="flex min-h-[90vh] flex-col items-center bg-white px-4 py-8 font-[family-name:var(--font-poppins)]">
      <div className="flex w-full max-w-md flex-1 flex-col items-center">
        {/* YuktiPrep Brand Logo */}
        <div className="flex justify-center">
          <Image
            src="/yuktiprep.png"
            height={90}
            width={90}
            alt="YuktiPrep"
            className="h-20 w-auto object-contain"
            priority
          />
        </div>

        {/* Tagline & Decorative Divider */}
        <p className="mt-3 text-center text-sm text-gray-600">
          AI-Powered Exam Preparation & Management
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-px w-8 bg-orange-400" />
          <div className="h-1.5 w-1.5 rounded-full bg-orange-400" />
          <div className="h-px w-8 bg-orange-400" />
        </div>

        {/* Heading & Subtitle matching web login */}
        <div className="mt-7 w-full text-center">
          <h1 className="text-2xl font-bold text-[#1F314D]">
            Admin Portal Login
          </h1>
          <div className="mx-auto mt-2 h-1 w-16 rounded-full bg-orange-400" />
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in with your administrative credentials to continue
          </p>
        </div>

        {/* Session Expired Banner */}
        {sessionExpired && (
          <div className="mt-5 w-full rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800 flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>Your session has expired. Please sign in again.</span>
          </div>
        )}

        {/* Error Banner */}
        {loginMutation.isError && (
          <div className="mt-5 w-full rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>
              {/* @ts-expect-error backend response type */}
              {loginMutation.error?.response?.data?.message ||
                "Invalid email or password. Please try again."}
            </span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="mt-6 w-full space-y-4">
          {/* Email Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="text-xs font-semibold uppercase tracking-wider text-gray-600"
            >
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="pointer-events-none absolute left-3.5 h-4 w-4 text-gray-400" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3.5 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                placeholder="admin@yuktiprep.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loginMutation.isPending}
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-wider text-gray-600"
            >
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="pointer-events-none absolute left-3.5 h-4 w-4 text-gray-400" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-11 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loginMutation.isPending}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loginMutation.isPending || !email || !password}
            className="mt-2 h-12 w-full rounded-xl bg-[#0f172a] text-base font-semibold text-white shadow-sm transition-all hover:bg-[#1e293b] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loginMutation.isPending ? "Signing in..." : "Sign in to Dashboard"}
          </button>
        </form>

        {/* Security / Terms Notice matching web login style */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-gray-500">
          <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
          <span>YuktiPrep Secure Admin Authentication</span>
        </div>

        <p className="mt-42 text-center text-xs text-gray-400">
          YuktiPrep &bull; All rights reserved &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

