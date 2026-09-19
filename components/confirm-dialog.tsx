"use client";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Annuler",
  danger = false,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.2_0.01_90/0.45)]"
      onClick={onCancel}
    >
      <div
        className="flex w-[420px] max-w-[90vw] flex-col gap-5 rounded-[14px] bg-white p-8 shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={
            "font-serif text-[21px] font-semibold " +
            (danger ? "text-danger-strong" : "text-ink")
          }
        >
          {title}
        </div>
        <div className="text-sm leading-[1.6] text-muted-light">{description}</div>
        <div className="mt-1.5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="cursor-pointer rounded-lg border border-border-strong px-5 py-2.5 text-[13.5px] font-semibold text-ink-40 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={
              "cursor-pointer rounded-lg px-5 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-60 " +
              (danger ? "bg-[oklch(0.5_0.18_25)]" : "bg-ink")
            }
          >
            {pending ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
