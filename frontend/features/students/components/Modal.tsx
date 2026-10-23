"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  description,
  onClose,
  children,
  disableClose = false,
  size = "max-w-xl",
}: Readonly<{
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  disableClose?: boolean;
  size?: string;
}>) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !disableClose) onCloseRef.current();
      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [disableClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !disableClose) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? "modal-description" : undefined}
        className={`max-h-[92vh] w-full ${size} overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl`}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div>
            <h2 id="modal-title" className="text-lg font-semibold text-slate-900">{title}</h2>
            {description && <p id="modal-description" className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={disableClose}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
          >
            <X size={19} />
          </button>
        </header>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
