"use client";

import { useState } from "react";

/**
 * Shared modal shell, animated as in the "Prototype Entraînement" design:
 * the backdrop fades in while the panel rises slightly into place, and
 * closing plays the same animation in reverse before unmounting. Clicking
 * the backdrop calls `onClose`; clicks inside the panel don't.
 */
export function Modal({
  open,
  onClose,
  panelClassName,
  children,
}: {
  open: boolean;
  onClose: () => void;
  panelClassName: string;
  children: React.ReactNode;
}) {
  // Stay mounted while the closing animation plays.
  const [closing, setClosing] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    setClosing(!open);
  }

  if (!open && !closing) return null;

  return (
    <div
      className={
        "fixed inset-0 z-50 flex items-center justify-center bg-[rgba(32,30,29,0.35)] " +
        (open ? "modal-backdrop-in" : "modal-backdrop-out pointer-events-none")
      }
      onClick={onClose}
    >
      <div
        className={
          panelClassName + " " + (open ? "modal-panel-in" : "modal-panel-out")
        }
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={() => {
          if (!open) setClosing(false);
        }}
      >
        {children}
      </div>
    </div>
  );
}
