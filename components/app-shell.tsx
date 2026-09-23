"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { NAV_ITEMS, FREE_MAX_CARDS_PER_EXERCISE } from "@/lib/constants";
import type { Quota } from "@/lib/quota";
import { UpsellModal } from "@/components/upsell-modal";

function Logo() {
  return (
    <div className="flex flex-col gap-[5px]">
      <div className="font-serif text-[23px] font-semibold tracking-[-0.01em] text-ink">
        Versus
      </div>
      <div className="h-[3px] w-[26px] rounded-sm bg-accent" />
    </div>
  );
}

function QuotaWidget({ quota, onUpgradeClick }: { quota: Quota; onUpgradeClick: () => void }) {
  if (quota.isPremium) {
    return (
      <div className="mt-auto rounded-[10px] bg-accent p-4 text-[12.5px] leading-[1.5] text-accent-light">
        <div className="mb-1 flex items-center gap-1.5 font-semibold text-white">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.9 6.6L22 9.3l-5 4.8L18.2 22 12 18.3 5.8 22 7 14.1l-5-4.8 7.1-0.7z" />
          </svg>
          Versus Upper
        </div>
        <div>Entraînement illimité</div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onUpgradeClick}
      className="mt-auto cursor-pointer rounded-[10px] bg-paper-alt p-4 text-left text-[12.5px] leading-[1.5] text-muted-light"
    >
      <div className="mb-1 font-semibold text-ink-softer">Versus gratuit</div>
      <div className="relative h-[18px] overflow-hidden">
        <span className="animate-quota-a absolute top-0 left-0 whitespace-nowrap">
          {quota.exercisesRemaining} exercice{quota.exercisesRemaining === 1 ? "" : "s"} restant
          {quota.exercisesRemaining === 1 ? "" : "s"} ce mois-ci
        </span>
        <span className="animate-quota-b absolute top-0 left-0 whitespace-nowrap">
          Max. {FREE_MAX_CARDS_PER_EXERCISE} cartes ajoutées par exercice
        </span>
      </div>
    </button>
  );
}

export function AppShell({ quota, children }: { quota: Quota; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="relative flex h-screen overflow-hidden bg-paper">
      {open && (
        <div className="flex h-screen w-80 flex-shrink-0 flex-col gap-9 overflow-y-hidden border-r border-border bg-white px-6 py-8">
          <div className="flex items-center justify-between">
            <Logo />
            <button
              type="button"
              title="Fermer la sidebar"
              onClick={() => setOpen(false)}
              className="flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-[7px] text-[13px] text-muted-light"
            >
              «
            </button>
          </div>

          <nav className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    "rounded-lg px-3.5 py-2.5 text-sm " +
                    (active
                      ? "bg-accent-light font-semibold text-accent-ink"
                      : "font-medium text-ink-40")
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <QuotaWidget quota={quota} onUpgradeClick={() => setUpsellOpen(true)} />
        </div>
      )}

      {!open && (
        <button
          type="button"
          title="Ouvrir la sidebar"
          onClick={() => setOpen(true)}
          className="fixed top-6 left-6 z-10 flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-[7px] border border-border bg-white text-[13px] text-muted-light shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
        >
          »
        </button>
      )}

      <div className="h-screen min-w-0 flex-1 overflow-y-auto">{children}</div>

      <UpsellModal open={upsellOpen} onClose={() => setUpsellOpen(false)} />
    </div>
  );
}
