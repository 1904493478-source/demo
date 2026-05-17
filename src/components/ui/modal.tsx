import React from "react";
import ReactDOM from "react-dom";
import { cn } from "@/lib/utils";
import Button from "./button";

type ModalProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  closeLabel?: string;
  showCloseButton?: boolean;
  contentTestId?: string;
};

export default function Modal({
  open,
  title,
  onClose,
  children,
  className,
  closeLabel = "Close",
  showCloseButton = true,
  contentTestId,
}: ModalProps) {
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

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative z-10 w-[520px] max-w-[90vw] rounded-md border border-border bg-surface p-6 shadow-lift",
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={contentTestId}
      >
        <div
          className={cn(
            "mb-4 flex items-center",
            showCloseButton ? "justify-between" : "justify-start"
          )}
        >
          {title && <h2 className="text-base font-semibold text-text">{title}</h2>}
          {showCloseButton ? (
            <Button variant="ghost" onClick={onClose} aria-label={closeLabel}>
              {closeLabel}
            </Button>
          ) : null}
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
