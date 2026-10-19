import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YuktiPrep Admin Dashboard",
  description: "Official-Source-First Competitive Exams Dashboard",
};

import Providers from "./providers";
import AdminAuthMiddleware from "../components/admin-auth-middleware";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${geistMono.variable} font-sans h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <Providers>
          <AdminAuthMiddleware>
            {children}
          </AdminAuthMiddleware>
        </Providers>
      </body>
    </html>
  );
}
