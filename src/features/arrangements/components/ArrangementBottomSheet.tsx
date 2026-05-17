import React from "react";
import type { ReactNode } from "react";

type ArrangementBottomSheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  testId?: string;
  onAfterClose?: () => void;
};

const EXIT_DURATION_MS = 220;

export function ArrangementBottomSheet({
  open,
  title,
  onClose,
  children,
  testId,
  onAfterClose,
}: ArrangementBottomSheetProps) {
  const [shouldRender, setShouldRender] = React.useState(open);
  const closeTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (open) {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setShouldRender(true);
      return;
    }

    if (!shouldRender) return;

    closeTimerRef.current = window.setTimeout(() => {
      setShouldRender(false);
      closeTimerRef.current = null;
      onAfterClose?.();
    }, EXIT_DURATION_MS);

    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [onAfterClose, open, shouldRender]);

  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!shouldRender) return null;

  const motionState = open ? "open" : "closing";

  return (
    <div className="absolute inset-0 z-50 flex items-end" data-motion-state={motionState}>
      <button
        type="button"
        className={[
          "absolute inset-0 bg-overlay transition-opacity duration-[180ms]",
          "ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={onClose}
        aria-label="关闭抽屉背景"
        tabIndex={-1}
      />
      <section
        className={[
          "relative z-10 flex max-h-[86%] w-full flex-col overflow-hidden rounded-t-[16px]",
          "border border-border-light bg-[var(--dialog-bg)] shadow-[0_-12px_36px_rgba(0,0,0,0.18)]",
          "transition-[transform,opacity] duration-[240ms] will-change-transform",
          "ease-[cubic-bezier(0.32,0.72,0,1)]",
          open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        ].join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-motion-state={motionState}
        data-testid={testId}
      >
        <header className="shrink-0 border-b border-border-light px-4 pb-3 pt-2.5">
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-fill-2" />
          <div className="flex items-center gap-3">
            <h2 className="min-w-0 flex-1 truncate text-[14px] leading-5 text-text">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-tertiary transition duration-200 hover:bg-hover-overlay hover:text-text active:scale-[0.96]"
              aria-label="关闭抽屉"
              tabIndex={open ? 0 : -1}
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3">{open ? children : null}</div>
      </section>
    </div>
  );
}
