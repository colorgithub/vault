"use client";

import { useEffect, useState } from "react";

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
            "animate-slide-up pointer-events-auto max-w-[min(26rem,100%)] rounded-lg px-3.5 py-2 text-xs shadow-lg",
            item.type === "error"
              ? "bg-rose-600 text-white"
              : "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900",
          )}
        >
          <span className="break-words">{item.message}</span>
        </div>
      ))}
    </div>
  );
}
