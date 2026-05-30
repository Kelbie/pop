import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * Right-anchored slide-over panel rendered in a portal. The wall stays visible
 * behind it (dimmed), so you can write a note while seeing the guestbook.
 * Mirrors Modal's Escape / click-outside / body-scroll-lock behavior.
 */
export function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  children,
}: SlideOverProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="pop-modal-fade fixed inset-0 z-50 flex justify-end bg-ink/30 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="pop-sheet-in flex h-full w-full max-w-md flex-col border-l border-hairline bg-polaroid text-ink shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-hairline px-6 py-4">
          <div className="space-y-1">
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-lg p-1 text-muted transition hover:bg-paper hover:text-ink"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
