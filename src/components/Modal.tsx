"use client";

import { useEffect } from "react";

import { IconClose } from "@/components/Icons";
import { cn } from "@/lib/client";

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  size = "md",
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="关闭"
        className="absolute inset-0 animate-fade-in bg-slate-900/25 dark:bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "animate-slide-up relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-xl dark:border-slate-800 dark:bg-slate-950",
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium">{title}</h2>
            {description && (
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost -mr-2 -mt-1.5 p-1.5"
            aria-label="关闭"
          >
            <IconClose className="size-4" />
          </button>
        </header>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
