"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { IconClipboard, IconScreen, IconUpload } from "@/components/Icons";
import { cn, getClientCaps } from "@/lib/client";

/**
 * 取 2D 上下文。
 *
 * `willReadFrequently` 是 Chromium 60 才认的选项；旧 WebView 上它会被忽略，
 * 但个别更老的实现对未知字典项会直接返回 null。这里做一次兜底，
 * 避免因为一个性能提示就让整个扫码功能失效。
 */
function get2dContext(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D | null {
  const withHint = canvas.getContext("2d", {
    willReadFrequently: true,
  }) as CanvasRenderingContext2D | null;
  if (withHint) return withHint;
  return canvas.getContext("2d") as CanvasRenderingContext2D | null;
}

/**
 * 等待图片可用。
 *
 * `HTMLImageElement.decode()` 需要 Chromium 64；旧 WebView 上不存在。
 * 回退到 onload/onerror。
 */
function decodeImageElement(img: HTMLImageElement): Promise<void> {
  if (typeof img.decode === "function") {
    return img.decode().catch(() => undefined);
  }
  return new Promise<void>((resolve) => {
    if (img.complete && img.naturalWidth > 0) return resolve();
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });
}

/** 出于体积考虑，jsQR 在真正需要解码时才动态载入 */
async function decodeImage(
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<string | null> {
  if (width < 8 || height < 8) return null;
  const canvas = document.createElement("canvas");
  const ctx = get2dContext(canvas);
  if (!ctx) return null;

  const { default: jsQR } = await import("jsqr");

  const attempt = (w: number, h: number) => {
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(source, 0, 0, w, h);
    const image = ctx.getImageData(0, 0, w, h);
    return (
      jsQR(image.data, w, h, { inversionAttempts: "attemptBoth" })?.data ?? null
    );
  };

  // 先按原图试一次
  const direct = attempt(width, height);
  if (direct) return direct;

  // 截图常常带大块留白，降采样再试一次
  const longest = Math.max(width, height);
  if (longest > 1600) {
    const scale = 1600 / longest;
    return attempt(Math.round(width * scale), Math.round(height * scale));
  }
  return null;
}

async function decodeBlob(blob: Blob): Promise<string | null> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    // decode() 需要 Chromium 64，旧 WebView 上回退到 onload
    await decodeImageElement(img);
    return await decodeImage(img, img.naturalWidth, img.naturalHeight);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Status = "idle" | "capturing";

export function QrScanner({ onResult }: { onResult: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastHitRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });

  const [status, setStatus] = useState<Status>("idle");
  const [hint, setHint] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  // 旧 WebView 上 getDisplayMedia / clipboard.read 可能不存在。
  // 按能力隐藏入口，而不是让按钮点了没反应。
  const caps = useMemo(() => getClientCaps(), []);

  /** 命中结果：同一张码 2.5 秒内不重复触发 */
  const handleHit = useCallback(
    (text: string) => {
      const now = Date.now();
      if (
        lastHitRef.current.text === text &&
        now - lastHitRef.current.at < 2500
      ) {
        return;
      }
      lastHitRef.current = { text, at: now };
      // onResult 会一路走到 parseOtpUri；畸形输入（如标签里带 `%`）历史上会抛
      // URIError。这里兜住，绝不让异常逃逸出 DOM 事件回调或 rAF 循环。
      try {
        onResult(text);
      } catch (err) {
        // 失败就不占用 2.5 秒抑制窗口，让用户能立刻重试
        lastHitRef.current = { text: "", at: 0 };
        setHint(
          err instanceof Error
            ? `二维码内容无法解析：${err.message}`
            : "二维码内容无法解析",
        );
      }
    },
    [onResult],
  );

  /* ---------------------------- 屏幕捕获 ---------------------------- */

  const stopCapture = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
  }, []);

  const startCapture = useCallback(async () => {
    setHint("");
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setHint("当前浏览器不支持屏幕捕获，请改用粘贴或选择图片。");
      return;
    }
    stopCapture();
    setStatus("capturing");

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 10 },
        audio: false,
      });
      streamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (streamRef.current === stream) stopCapture();
      });

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.muted = true;
      await video.play().catch(() => undefined);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const { default: jsQR } = await import("jsqr");

      const tick = () => {
        if (!streamRef.current) return;
        const v = videoRef.current;
        if (v && ctx && v.readyState === v.HAVE_ENOUGH_DATA) {
          const w = v.videoWidth;
          const h = v.videoHeight;
          if (w > 0 && h > 0) {
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(v, 0, 0, w, h);
            try {
              const image = ctx.getImageData(0, 0, w, h);
              const found = jsQR(image.data, w, h, {
                inversionAttempts: "attemptBoth",
              });
              if (found?.data) handleHit(found.data);
            } catch {
              /* 帧未就绪时忽略 */
            }
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const name = (err as { name?: string })?.name;
      setStatus("idle");
      setHint(
        name === "NotAllowedError"
          ? "已取消屏幕共享。"
          : "无法开始屏幕捕获，请改用粘贴或选择图片。",
      );
    }
  }, [handleHit, stopCapture]);

  useEffect(() => () => stopCapture(), [stopCapture]);

  /* ---------------------------- 图片处理 ---------------------------- */

  const processBlob = useCallback(
    async (blob: Blob) => {
      setBusy(true);
      setHint("");
      try {
        const text = await decodeBlob(blob);
        if (text) handleHit(text);
        else setHint("没有识别到二维码，换一张更清晰的图片试试。");
      } catch (err) {
        // 以前这里只有 finally：任何异常都会变成 unhandled rejection，
        // 用户看到的是「点了没反应」。
        setHint(
          err instanceof Error
            ? `图片处理失败：${err.message}`
            : "图片处理失败，请换一张图片试试。",
        );
      } finally {
        setBusy(false);
      }
    },
    [handleHit],
  );

  /** Ctrl/⌘ + V 粘贴：优先取图片，其次接受 otpauth 纯文本 */
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const data = event.clipboardData;
      if (!data) return;

      for (const item of data.items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            void processBlob(file);
            return;
          }
        }
      }

      const text = data.getData("text")?.trim();
      if (text && /^otpauth(-migration)?:\/\//i.test(text)) {
        event.preventDefault();
        handleHit(text);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleHit, processBlob]);

  /** 从系统剪贴板读取图片（需浏览器授权） */
  async function pasteFromClipboard() {
    setHint("");
    const clipboard = navigator.clipboard as
      | (Clipboard & { read?: () => Promise<ClipboardItem[]> })
      | undefined;
    if (!clipboard?.read) {
      setHint("当前浏览器不支持直接读取剪贴板，请按 Ctrl/⌘ + V 粘贴。");
      return;
    }
    try {
      const items = await clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) {
          await processBlob(await item.getType(type));
          return;
        }
      }
      setHint("剪贴板里没有图片。先截图或复制二维码，再点这里。");
    } catch {
      setHint("浏览器拒绝了剪贴板读取。请直接按 Ctrl/⌘ + V 粘贴。");
    }
  }

  return (
    <div className="space-y-3">
      {/* 预览 / 拖放区 */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = Array.from(e.dataTransfer.files).find((f) =>
            f.type.startsWith("image/"),
          );
          if (file) void processBlob(file);
          else setHint("请拖入一张图片文件。");
        }}
        className={cn(
          "relative grid w-full place-items-center overflow-hidden rounded-xl border border-dashed transition",
          status === "capturing" ? "aspect-video" : "min-h-[8rem] py-8",
          dragging
            ? "border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-900"
            : "border-slate-200 dark:border-slate-800",
        )}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className={cn(
            "size-full object-contain",
            status === "capturing" ? "block" : "hidden",
          )}
        />

        {status === "capturing" ? (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 size-[46%] -translate-x-1/2 -translate-y-1/2">
              <div className="absolute inset-0 rounded-lg border border-white/60" />
              <span
                className="absolute inset-x-1 h-px bg-white/90 shadow-[0_0_8px_1px] shadow-white/60"
                style={{
                  animation: "scan-line 2.4s ease-in-out infinite alternate",
                }}
              />
            </div>
            <button
              type="button"
              onClick={stopCapture}
              className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-900"
            >
              停止共享
            </button>
          </div>
        ) : (
          <div className="px-6 text-center">
            <IconClipboard className="mx-auto size-5 text-slate-300 dark:text-slate-600" />
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              {busy ? "正在识别…" : "粘贴或拖入含有二维码的图片"}
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              按{" "}
              <kbd className="rounded border border-slate-200 px-1 dark:border-slate-700">
                Ctrl/⌘ V
              </kbd>{" "}
              直接粘贴截图
            </p>
          </div>
        )}
      </div>

      {/* 入口：按能力显示。旧 WebView 上不支持的直接隐藏，避免点了没反应 */}
      <div className="flex flex-wrap gap-2">
        {caps.clipboardRead && (
          <button
            type="button"
            onClick={() => void pasteFromClipboard()}
            className="btn-outline flex-1"
          >
            <IconClipboard className="size-4" />
            粘贴图片
          </button>
        )}
        {caps.displayCapture && (
          <button
            type="button"
            onClick={() =>
              status === "capturing" ? stopCapture() : void startCapture()
            }
            className={cn(
              "btn-outline flex-1",
              status === "capturing" && "btn-primary",
            )}
          >
            <IconScreen className="size-4" />
            {status === "capturing" ? "停止共享" : "截取屏幕"}
          </button>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="btn-outline flex-1"
        >
          <IconUpload className="size-4" />
          选择图片
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void processBlob(file);
            e.target.value = "";
          }}
        />
      </div>

      {/* 能力不足时说明可用的替代方式 */}
      {(!caps.clipboardRead || !caps.displayCapture) && (
        <p className="text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          当前浏览器版本较旧
          {!caps.displayCapture && "，不支持截取屏幕"}
          {!caps.clipboardRead && "，不支持直接读取剪贴板"}
          。请改用
          <span className="mx-0.5 font-medium">选择图片</span>
          或直接按{" "}
          <kbd className="rounded border border-slate-200 px-1 dark:border-slate-700">
            Ctrl/⌘ V
          </kbd>{" "}
          粘贴截图。
        </p>
      )}

      {hint && (
        <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>
      )}
    </div>
  );
}
