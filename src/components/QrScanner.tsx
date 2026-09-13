"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { IconCamera, IconRefresh, IconUpload } from "@/components/Icons";

type Status = "idle" | "starting" | "running" | "error";

export function QrScanner({
  onResult,
  onError,
}: {
  onResult: (text: string) => void;
  onError?: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const cancelledRef = useRef(false);
  const lastHitRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });

  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const handleHit = useCallback(
    (text: string) => {
      const now = Date.now();
      if (lastHitRef.current.text === text && now - lastHitRef.current.at < 2500) {
        return;
      }
      lastHitRef.current = { text, at: now };
      onResult(text);
    },
    [onResult],
  );

  const stop = useCallback(() => {
    cancelledRef.current = true;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(async () => {
    stop();
    cancelledRef.current = false;
    setStatus("starting");
    setMessage("");

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setStatus("error");
      setMessage("当前浏览器不支持摄像头，请改用「上传二维码图片」方式。");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (cancelledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play().catch(() => undefined);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const { default: jsQR } = await import("jsqr");

      setStatus("running");

      const tick = () => {
        if (cancelledRef.current) return;
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
              if (found?.data) {
                handleHit(found.data);
              }
            } catch {
              /* 某些浏览器在帧未就绪时会抛错，忽略 */
            }
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const name = (err as { name?: string })?.name;
      const hint =
        name === "NotAllowedError"
          ? "摄像头权限被拒绝，请在浏览器地址栏允许摄像头后重试。"
          : name === "NotFoundError"
            ? "没有检测到摄像头设备，请改用上传图片方式。"
            : "无法启动摄像头，请改用上传二维码图片方式。";
      setStatus("error");
      setMessage(hint);
      onError?.(hint);
    }
  }, [handleHit, onError, stop]);

  useEffect(() => {
    void start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 从图片文件解析 */
  async function handleFile(file: File) {
    setMessage("");
    try {
      const bitmapUrl = URL.createObjectURL(file);
      const img = new Image();
      img.src = bitmapUrl;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("no-ctx");
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(bitmapUrl);

      const { default: jsQR } = await import("jsqr");
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const found = jsQR(image.data, canvas.width, canvas.height, {
        inversionAttempts: "attemptBoth",
      });
      if (found?.data) {
        handleHit(found.data);
        setMessage("已识别图片中的二维码");
      } else {
        setMessage("图片里没有识别到二维码，换一张更清晰的试试。");
      }
    } catch {
      setMessage("图片读取失败，请换一张再试。");
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-800 sm:aspect-video">
        <video
          ref={videoRef}
          className="size-full object-cover"
          muted
          playsInline
          autoPlay
        />

        {/* 扫描框 */}
        {status === "running" && (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 size-[62%] max-w-[16rem] -translate-x-1/2 -translate-y-1/2 sm:size-[58%]">
              <div className="absolute inset-0 rounded-2xl ring-2 ring-white/70" />
              {[
                "left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl",
                "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl",
                "left-0 bottom-0 border-b-4 border-l-4 rounded-bl-2xl",
                "right-0 bottom-0 border-b-4 border-r-4 rounded-br-2xl",
              ].map((cls) => (
                <span
                  key={cls}
                  className={`absolute size-8 border-brand-400 ${cls}`}
                />
              ))}
              <span
                className="absolute inset-x-2 h-0.5 bg-brand-400/90 shadow-[0_0_12px_2px] shadow-brand-400/60"
                style={{ animation: "scan-line 2.4s ease-in-out infinite alternate" }}
              />
            </div>
          </div>
        )}

        {status !== "running" && (
          <div className="absolute inset-0 grid place-items-center bg-slate-900/80 px-6 text-center">
            <div className="flex flex-col items-center gap-2 text-slate-300">
              {status === "starting" ? (
                <>
                  <span className="size-7 animate-spin rounded-full border-2 border-slate-600 border-t-brand-400" />
                  <p className="text-sm">正在启动摄像头…</p>
                </>
              ) : (
                <>
                  <IconCamera className="size-8 text-slate-500" />
                  <p className="text-sm">{message || "摄像头未启动"}</p>
                  <button
                    type="button"
                    onClick={() => void start()}
                    className="btn-outline mt-2 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  >
                    <IconRefresh className="size-4" />
                    重试
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="btn-outline cursor-pointer">
          <IconUpload className="size-4" />
          上传二维码图片
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          对准二维码即可自动识别，也支持相册里的截图
        </p>
      </div>

      {message && status === "running" && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{message}</p>
      )}
    </div>
  );
}
