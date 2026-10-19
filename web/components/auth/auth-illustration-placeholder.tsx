"use client";

import Image from "next/image";

interface AuthIllustrationPlaceholderProps {
  type?: "login" | "otp";
  className?: string;
}

export function AuthIllustrationPlaceholder({ type = "login", className }: AuthIllustrationPlaceholderProps) {
  const isOtp = type === "otp";
  const imageSrc = isOtp ? "/otp-logo.png" : "/signin-logo.png";
  const altText = isOtp ? "OTP verification illustration" : "Sign in illustration";

  return (
    <div className={`flex w-full items-center justify-center ${className || ""}`}>
      <div className="flex items-center justify-center w-full max-w-xs">
        <Image
          src={imageSrc}
          alt={altText}
          width={300}
          height={150}
          priority
          className="h-32 sm:h-36 w-auto max-w-full object-contain"
        />
      </div>
    </div>
  );
}

export function OTPIllustrationPlaceholder({ className }: { className?: string }) {
  return (
    <div className={`flex w-full items-center justify-center ${className || ""}`}>
      <div className="flex items-center justify-center w-full max-w-xs">
        <Image
          src="/otp-logo.png"
          alt="OTP illustration"
          width={300}
          height={150}
          priority
          className="h-32 sm:h-36 w-auto max-w-full object-contain"
        />
      </div>
    </div>
  );
}
