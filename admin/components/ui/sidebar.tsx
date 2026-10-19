"use client";
import { cn } from "@/lib/utils";
import React, { useState, createContext, useContext } from "react";
import { motion } from "motion/react";
import { PanelLeft, PanelLeftClose } from "lucide-react";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
  email?: string;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate: animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  return <DesktopSidebar {...props} />;
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <>
      {/* Mobile / Tablet Backdrop Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-neutral-900/30 backdrop-blur-xs z-30 lg:hidden transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}
      <motion.div
        className={cn(
          "h-screen sticky top-0 py-4 flex flex-col bg-[#F8FAFC] shrink-0 transition-all duration-200 z-40 border-r border-neutral-200/80",
          open
            ? "px-4 w-[280px] max-lg:fixed max-lg:left-0 max-lg:top-0 max-lg:shadow-2xl"
            : "px-2.5 w-[68px]",
          className
        )}
        animate={{
          width: animate ? (open ? "280px" : "68px") : "280px",
        }}
        onMouseEnter={() => {
          if (typeof window !== "undefined" && window.innerWidth >= 1024) {
            setOpen(true);
          }
        }}
        onMouseLeave={() => {
          if (typeof window !== "undefined" && window.innerWidth >= 1024) {
            setOpen(false);
          }
        }}
        {...props}
      >
        {children}
      </motion.div>
    </>
  );
};

export const SidebarTrigger = ({ className }: { className?: string }) => {
  const { open, setOpen } = useSidebar();
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-label={open ? "Close sidebar" : "Open sidebar"}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200/80 bg-white text-neutral-600 shadow-xs hover:bg-neutral-50 hover:text-neutral-900 transition-colors focus:outline-none",
        className
      )}
    >
      {open ? (
        <PanelLeftClose className="h-4 w-4 text-[#087E8B]" />
      ) : (
        <PanelLeft className="h-4 w-4 text-[#087E8B]" />
      )}
    </button>
  );
};

export const SidebarLink = ({
  link,
  className,
  ...props
}: {
  link: Links;
  className?: string;
}) => {
  const { open, animate } = useSidebar();
  return (
    <a
      href={link.href}
      className={cn(
        "flex items-center gap-3 group/sidebar py-2 transition-all duration-150",
        open ? "justify-start" : "justify-center",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-center shrink-0">
        {link.icon}
      </div>

      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="text-inherit text-sm group-hover/sidebar:translate-x-0.5 transition duration-150 whitespace-nowrap inline-block !p-0 !m-0"
      >
        <span className="font-semibold block leading-tight">{link.label}</span>
        {link.email && (
          <span className="text-xs font-normal text-neutral-500 truncate max-w-[170px] block mt-0.5">
            {link.email}
          </span>
        )}
      </motion.span>
    </a>
  );
};
