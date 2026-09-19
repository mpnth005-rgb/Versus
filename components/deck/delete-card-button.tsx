"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/confirm-dialog";

export function DeleteCardButton({ cardId }: { cardId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirmDelete() {
    setPending(true);
    try {
      await fetch(`/api/deck/cards/${cardId}`, { method: "DELETE" });
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Supprimer"
        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-border-strong text-[11px] text-[oklch(0.55_0.13_25)]"
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
