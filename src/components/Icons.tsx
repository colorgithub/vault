import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={20}
      height={20}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconMemo = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 3h8a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z" />
    <path d="M9 8h6M9 12h6M9 16h4" />
  </Base>
);

export const IconShield = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3l7 3v6c0 4.2-2.9 7.9-7 9-4.1-1.1-7-4.8-7-9V6l7-3Z" />
    <path d="M9.5 12.2l1.8 1.8 3.4-3.6" />
  </Base>
);

export const IconSearch = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </Base>
);

export const IconPlus = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconTrash = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
    <path d="M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7" />
    <path d="M10 11v6M14 11v6" />
  </Base>
);

export const IconPin = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 4h6l-.8 5.2 3 3.3H6.8l3-3.3L9 4Z" />
    <path d="M12 12.5V20" />
  </Base>
);

export const IconCopy = (p: IconProps) => (
  <Base {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2.5" />
    <path d="M15 6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15" />
  </Base>
);

export const IconCheck = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Base>
);

export const IconSun = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" />
  </Base>
);

export const IconMoon = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2Z" />
  </Base>
);

export const IconLogout = (p: IconProps) => (
  <Base {...p}>
    <path d="M15 4h2.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H15" />
    <path d="M10 8l-4 4 4 4M6 12h9" />
  </Base>
);

export const IconClose = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Base>
);

export const IconCamera = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2a1.5 1.5 0 0 0 1.3-.75l.5-.9A1.5 1.5 0 0 1 10.8 3.6h2.4a1.5 1.5 0 0 1 1.3.75l.5.9A1.5 1.5 0 0 0 16.3 6h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" />
    <circle cx="12" cy="12.5" r="3.2" />
  </Base>
);

export const IconUpload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 16V5" />
    <path d="M8 8.5L12 4.5l4 4" />
    <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
  </Base>
);

export const IconQr = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="4" width="6" height="6" rx="1.5" />
    <rect x="14" y="4" width="6" height="6" rx="1.5" />
    <rect x="4" y="14" width="6" height="6" rx="1.5" />
    <path d="M14 14h2.5v2.5H14zM19.5 14v.01M14 19.5v.01M19.5 19.5v.01M17 17h2.5v2.5" />
  </Base>
);

export const IconEye = (p: IconProps) => (
  <Base {...p}>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Base>
);

export const IconEyeOff = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 3l18 18" />
    <path d="M10.6 6.1A8.9 8.9 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.4 3.2M6.3 7.9A17 17 0 0 0 2.5 12s3.5 6 9.5 6a8.7 8.7 0 0 0 3.8-.85" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Base>
);

export const IconMenu = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
);

export const IconLock = (p: IconProps) => (
  <Base {...p}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </Base>
);

export const IconMail = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
    <path d="M4 7.5l7.3 5a1.2 1.2 0 0 0 1.4 0l7.3-5" />
  </Base>
);

export const IconUser = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </Base>
);

export const IconKey = (p: IconProps) => (
  <Base {...p}>
    <circle cx="8" cy="15" r="3.8" />
    <path d="M10.8 12.4l8-8M16.5 6.7l1.8 1.8M14 9.2l1.8 1.8" />
  </Base>
);

export const IconDownload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4v11" />
    <path d="M8 11.5l4 4 4-4" />
    <path d="M5 19h14" />
  </Base>
);

export const IconPencil = (p: IconProps) => (
  <Base {...p}>
    <path d="M16.5 4.6l2.9 2.9L9.4 17.4l-3.8.9.9-3.8Z" />
    <path d="M14.6 6.5l2.9 2.9" />
  </Base>
);

export const IconRefresh = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 11.5A8 8 0 0 0 6.2 6.2L4 8.3" />
    <path d="M4 4.5v4h4" />
    <path d="M4 12.5a8 8 0 0 0 13.8 5.3L20 15.7" />
    <path d="M20 19.5v-4h-4" />
  </Base>
);

export const IconSparkle = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5l1.7 4.6 4.6 1.7-4.6 1.7L12 16.1l-1.7-4.6L5.7 9.8l4.6-1.7L12 3.5Z" />
    <path d="M18.5 15.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9Z" />
  </Base>
);

export const IconClipboard = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 4.5h6M9 4.5a1.5 1.5 0 0 0-1.5 1.5v.5h9V6A1.5 1.5 0 0 0 15 4.5" />
    <path d="M7.5 6.5H6.8A1.8 1.8 0 0 0 5 8.3v10.4a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8V8.3a1.8 1.8 0 0 0-1.8-1.8h-.7" />
  </Base>
);

export const IconScreen = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="4.5" width="18" height="12" rx="2" />
    <path d="M9 20h6M12 16.5V20" />
    <circle cx="12" cy="10.5" r="2" />
  </Base>
);
