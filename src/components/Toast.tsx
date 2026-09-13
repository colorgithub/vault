"use client";

import { useEffect, useState } from "react";

import { IconCheck, IconClose } from "@/components/Icons";
import { cn } from "@/lib/client";

export interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

type Listener = (item: ToastItem) => void;

let listener: Listener | null = null;
let seq = 0;

export function toast(message: string, type: ToastItem["type"] = "success") {
  const item: ToastItem = { id: ++seq, message, type };
  listener?.(item);
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    listener = (item) => {
      setItems((prev) => [...prev.slice(-2), item]);
      setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }, 2600);
    };
    return () => {
      listener = null;
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2 px-4">
      {items.map((item) => (
        <div
          key={item.id}
          role="status"
          className={cn(
            "animate-slide-up pointer-events-auto flex max-w-[min(28rem,100%)] items-center gap-2.5 rounded-2xl px-4 py-2.5 text-sm font-medium shadow-lg ring-1 backdrop-blur",
            item.type === "error"
              ? "bg-rose-600/95 text-white ring-rose-500/40"
              : item.type === "info"
                ? "bg-slate-900/92 text-white ring-white/10"
                : "bg-slate-900/92 text-white ring-white/10",
          )}
        >
          <span
            className={cn(
              "grid size-5 shrink-0 place-items-center rounded-full",
              item.type === "error" ? "bg-white/20" : "bg-emerald-500",
            )}
          >
            {item.type === "error" ? (
              <IconClose className="size-3.5" />
            ) : (
              <IconCheck className="size-3.5" />
            )}
          </span>
          <span className="min-w-0 break-words">{item.message}</span>
        </div>
      ))}
    </div>
  );
}
