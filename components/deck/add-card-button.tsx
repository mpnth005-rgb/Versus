"use client";

import { useState } from "react";
import Link from "next/link";

import { LockIcon } from "@/components/lock-icon";
import { UpsellModal } from "@/components/upsell-modal";

/**
 * "Ajouter une carte" — a link to the card form for Versus Upper users.
 * Adding cards manually is premium-only: free users see it greyed out
 * with a lock, and clicking it opens the upgrade modal instead.
 */
export function AddCardButton({ isPremium }: { isPremium: boolean }) {
  const [upsellOpen, setUpsellOpen] = useState(false);

  if (isPremium) {
    return (
      <Link
        href="/deck/cards/new"
        className="press-primary flex cursor-pointer items-center gap-2 rounded-lg bg-ink px-4.5 py-2.5 text-[13px] font-semibold text-white"
      >
        <span className="text-[15px]">+</span>Ajouter une carte
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setUpsellOpen(true)}
        title="Réservé à Versus Upper"
        className="press-locked flex cursor-pointer items-center gap-2 rounded-lg bg-paper-alt-3 px-4.5 py-2.5 text-[13px] font-semibold text-muted-lighter"
      >
        <LockIcon />
        Ajouter une carte
      </button>
      <UpsellModal open={upsellOpen} onClose={() => setUpsellOpen(false)} />
    </>
  );
}
