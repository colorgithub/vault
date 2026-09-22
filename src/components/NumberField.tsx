"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/client";

/**
 * 数字输入框。
 *
 * 不能把 `value={number}` 直接接到 `<input type="number">` 上、再在 onChange 里
 * clamp：用户敲 "15" 的第一个字符 "1" 会被 clamp 回 30 并写回输入框，导致
 * 除少数几个值外根本没法键入（原实现里 5..300 只有 55 个值能打出来）。
 *
 * 这里把「输入中的文本」与「已提交的数值」分开：
 *   - 文本合法（区间内的整数）就立即提交；
 *   - 文本暂时不合法也原样保留，让用户能把数字打完；
 *   - 失焦时若仍不合法，再回退到已提交的值。
 */
export function NumberField({
  value,
  min,
  max,
  onCommit,
  className,
  ...rest
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
  className?: string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "min" | "max" | "type"
>) {
  const [text, setText] = useState(String(value));

  // 外部值变化（切换账户、重置表单）时同步显示
  useEffect(() => {
    setText(String(value));
  }, [value]);

  function handleChange(next: string) {
    setText(next);
    const n = Number(next);
    if (next.trim() !== "" && Number.isInteger(n) && n >= min && n <= max) {
      onCommit(n);
    }
  }

  function handleBlur() {
    const n = Number(text);
    if (text.trim() === "" || !Number.isInteger(n) || n < min || n > max) {
      setText(String(value)); // 回退到上一个合法值
    } else if (n !== value) {
      onCommit(n);
    }
  }

  return (
    <input
      {...rest}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      className={cn("field py-2", className)}
    />
  );
}
