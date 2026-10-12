"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/confirm-dialog";

/** Folds a deleted card's row away (height and padding to 0, fading) so
 * the rows below slide up, before the list is refreshed without it. With
 * "Réduire les animations", it simply goes. */
async function foldRow(row: HTMLElement | null | undefined) {
  if (!row || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  row.style.height = `${row.offsetHeight}px`;
  row.style.overflow = "hidden";
  row.getBoundingClientRect(); // commit the starting height
  row.style.transition =
    "height var(--motion-base) var(--ease-move), padding var(--motion-base) var(--ease-move), border-width var(--motion-base) var(--ease-move), opacity var(--motion-fast) ease";
  row.style.height = "0px";
  row.style.paddingTop = "0px";
  row.style.paddingBottom = "0px";
  row.style.borderTopWidth = "0px";
  row.style.opacity = "0";
  await new Promise((resolve) => setTimeout(resolve, 300));
}

export function DeleteCardButton({ cardId }: { cardId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  async function confirmDelete() {
    setPending(true);
    try {
      await fetch(`/api/deck/cards/${cardId}`, { method: "DELETE" });
      setOpen(false);
      await foldRow(buttonRef.current?.closest<HTMLElement>("[data-card-row]"));
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        title="Supprimer"
        className="press-danger-icon flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-border-strong text-[11px] text-[oklch(0.55_0.13_25)]"
      >
        ✕
      </button>
      <ConfirmDialog
        open={open}
        title="Supprimer cette carte ?"
        description="Cette carte sera définitivement supprimée de votre deck de révision."
        confirmLabel="Supprimer"
        danger
        pending={pending}
        onConfirm={confirmDelete}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
