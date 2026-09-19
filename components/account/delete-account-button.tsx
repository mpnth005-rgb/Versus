"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/confirm-dialog";

export function DeleteAccountButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirmDelete() {
    setPending(true);
    try {
      await fetch("/api/account", { method: "DELETE" });
      router.push("/login");
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
        className="cursor-pointer whitespace-nowrap rounded-lg border border-[oklch(0.6_0.15_25)] px-5 py-[11px] text-[13.5px] font-semibold text-[oklch(0.45_0.15_25)]"
      >
        Supprimer le compte
      </button>
      <ConfirmDialog
        open={open}
        title="Supprimer votre compte ?"
        description="Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est définitive : votre progression, vos decks de révision et votre abonnement seront perdus."
        confirmLabel="Supprimer définitivement"
        danger
        pending={pending}
        onConfirm={confirmDelete}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
