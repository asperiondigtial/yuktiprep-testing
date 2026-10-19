"use client";

import React, { useState } from "react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { IconBrandTabler, IconSettings } from "@tabler/icons-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  Home,
  LogOut,
  BookOpen,
  ListChecks,
  FileText,
  Newspaper,
  Globe,
  CreditCard,
  MessageCircle,
  MessageSquareQuote,
  User,
  Users,
  Settings,
  Sparkles,
  Calendar,
  Layers,
  Receipt,
  Languages,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  ScanText,
  RotateCcw,
} from "lucide-react";
import Image from "next/image";
import { useAdminLogout, useAdminMe } from "@/hooks/useAdminAuth";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

/* =========================
   Logo Component
========================= */

export const Logo = () => {
  return (
    <Link
      href="/"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black"
    >
      <Image
        src="/yuktiprep.png"
        height={32}
        width={30}
        alt="YuktiPrep"
        className="h-8 w-[30px] object-contain shrink-0"
      />

      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-xl font-bold whitespace-pre text-black dark:text-white"
      >
        <span className="text-[#122851]">Yukti</span>
        <span className="relative text-[#00A6C0]">
          Prep
          <span className="absolute -top-0 -right-3 text-[10px] font-semibold text-[#122851]">TM</span>
        </span>
      </motion.span>
    </Link>
  );
};

/* =========================
   Collapsed Logo
========================= */

export const LogoIcon = () => {
  return (
    <Link
      href="/"
      className="relative z-20 flex w-full items-center justify-center py-1 text-sm font-normal text-black"
    >
      <Image
        src="/yuktiprep.png"
        height={28}
        width={28}
        alt="YuktiPrep"
        className="h-7 w-7 object-contain"
      />
    </Link>
  );
};

/* =========================
   Main Sidebar Component
========================= */

export default function SidebarDemo({
  children,
}: {
  children?: React.ReactNode;
}) {
  // Sidebar state
  const [open, setOpen] = useState(false);

  // API hooks
  const { mutate: logout } = useAdminLogout();
  const { data: admin } = useAdminMe();

  // Next.js hooks
  const router = useRouter();
  const pathname = usePathname();

  /* =========================
     Navigation Links
  ========================= */

  const links = [
    {
      label: "Dashboard",
      href: "/",
      icon: <Home />,
    },
    {
      label: "Users",
      href: "/users",
      icon: <Users />,
    },
    {
      label: "Exam Categories",
      href: "/exam-groups",
      icon: <Layers />,
    },
    {
      label: "Current Affairs",
      href: "/current-affairs",
      icon: <Newspaper />,
    },
    {
      label: "Question Intelligence",
      href: "/intelligence",
      icon: <Sparkles />,
    },
    {
      label: "ocr-main's",
      href: "/ocr-mains",
      icon: <ScanText />,
    },
    {
      label: "Competitive Exams",
      href: "/competitive-exams",
      icon: <Calendar />,
    },
    {
      label: "Exams",
      href: "/exams",
      icon: <BookOpen />,
    },
    {
      label: "Subjects",
      href: "/subjects",
      icon: <ListChecks />,
    },
    {
      label: "Topics",
      href: "/topics",
      icon: <IconBrandTabler />,
    },
    {
      label: "Syllabus",
      href: "/syllabus",
      icon: <FileText />,
    },
    {
      label: "PYQs",
      href: "/pyqs",
      icon: <IconSettings />,
    },
    {
      label: "Mock Tests",
      href: "/tests",
      icon: <Sparkles />,
    },

    {
      label: "Languages",
      href: "/languages",
      icon: <Languages />,
    },
    {
      label: "SEO Pages",
      href: "/seo-pages",
      icon: <Globe />,
    },
    {
      label: "Pricing",
      href: "/plans",
      icon: <CreditCard />,
    },
    {
      label: "Payments",
      href: "/payments",
      icon: <Receipt />,
    },
    {
      label: "Refund Requests",
      href: "/refunds",
      icon: <RotateCcw />,
    },
    {
      label: "WhatsApp Bot",
      href: "/whatsapp-bot",
      icon: <MessageCircle />,
    },
    {
      label: "YuktiPrep WA",
      href: "/yuktiprep-wa",
      icon: <MessageSquareQuote />,
    },
    {
      label: "Settings",
      href: "/settings",
      icon: <Settings />,
    },
    {
      label: "Profile",
      href: "/profile",
      icon: <User />,
    },
    {
      label: "Logout",
      href: "#",
      onClick: () => logout(),
      icon: <LogOut />,
    },
  ];

  /* =========================
     Handle Navigation
  ========================= */

  const handleNavigate = (
    href: string,
    onClick?: () => void
  ) => {
    if (onClick) {
      onClick();
      return;
    }

    if (href && href !== "#") {
      router.push(href);
    }
  };

  return (
    <div
      className={cn(
        "mx-auto flex h-screen w-full flex-row overflow-hidden bg-[#F8FAFC]",
      )}
    >
      {/* =========================
           Sidebar
      ========================= */}

      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          {/* Top Section */}

          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto no-scrollbar scrollbar-none">
            {/* Header with Opener / Closer for Mobile, Tablet & Desktop */}
            <div className="flex items-center justify-between gap-2 px-1">
              {open ? <Logo /> : <LogoIcon />}
              {open && (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-neutral-200/60 text-[#087E8B] transition shrink-0"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Opener button when collapsed */}
            {!open && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="mt-2.5 mx-auto flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200/80 bg-white text-[#087E8B] shadow-xs hover:bg-neutral-50 active:scale-95 transition"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Navigation Links */}

            <div className="mt-6 flex flex-col gap-1.5">
              {links.map((link, idx) => {
                /* =========================
                   Check Active Route
                ========================= */

                const isActive =
                  link.href !== "#" &&
                  (link.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(link.href));

                /* =========================
                   Add Dynamic Icon Color
                ========================= */

                const iconWithColor = React.isValidElement(
                  link.icon
                )
                  ? React.cloneElement(
                    link.icon as React.ReactElement<{
                      className?: string;
                    }>,
                    {
                      className: cn(
                        "h-5 w-5 shrink-0 transition-colors",
                        isActive
                          ? "!text-[#087E8B]"
                          : "text-[#102B59]"
                      ),
                    }
                  )
                  : link.icon;

                return (
                  <div
                    key={link.label || idx}
                    className="flex w-full justify-center"
                    onClick={() =>
                      handleNavigate(
                        link.href,
                        link.onClick
                      )
                    }
                  >
                    <SidebarLink
                      className={cn(
                        "flex cursor-pointer items-center",
                        "rounded-[20px] transition-all duration-150",

                        open
                          ? "w-full justify-start gap-3 px-3.5 py-2.5"
                          : "mx-auto h-10 w-10 justify-center p-0",

                        isActive
                          ? "bg-[#E9F7F7] font-semibold text-[#087E8B] shadow-xs"
                          : "text-[#263A59] font-medium hover:bg-neutral-200/50"
                      )}
                      link={{
                        label: link.label,
                        href: link.href,
                        icon: iconWithColor,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* =========================
              Admin Section
          ========================= */}

          <div className="flex w-full justify-center">
            <SidebarLink
              className={cn(
                "rounded-xl transition-all duration-150",

                open
                  ? "w-full justify-start gap-3 px-3 py-2"
                  : "mx-auto h-10 w-10 justify-center p-0"
              )}
              link={{
                label: admin?.name || "Admin User",
                email: admin?.email || "admin@example.com",
                href: "/profile",
                icon: (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 font-bold text-teal-800 overflow-hidden">
                    {admin?.profilePic ? (
                      <img
                        src={admin.profilePic}
                        alt={admin.name}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold text-[#6B55D9]">
                        {admin?.name?.[0]?.toUpperCase() || "A"}
                      </span>
                    )}
                  </div>
                ),
              }}
            />
          </div>
        </SidebarBody>
      </Sidebar>

      {/* =========================
          Main Content
      ========================= */}

      <main className="flex flex-1 flex-col min-w-0 h-full overflow-y-auto no-scrollbar scrollbar-none rounded-tl-2xl border border-neutral-200/80 bg-[#F8FAFC] p-4 shadow-sm md:p-10">
        {/* Mobile & Tablet Header with Menu Opener */}
        <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-neutral-200/80 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-neutral-800 shadow-xs active:bg-neutral-100 transition"
            aria-label="Toggle navigation menu"
          >
            <PanelLeft className="h-4 w-4 text-[#087E8B]" />
            <span>Open Menu</span>
          </button>
          <div className="flex items-center gap-2">
            <Image
              src="/yuktiprep.png"
              width={22}
              height={22}
              alt="YuktiPrep"
              className="object-contain"
            />
            <span className="text-sm font-bold text-[#122851]">Yukti<span className="text-[#00A6C0]">Prep</span></span>
          </div>
        </div>

        {children || (
          <div className="text-gray-500">
            Welcome to Admin Dashboard
          </div>
        )}
      </main>
    </div>
  );
}