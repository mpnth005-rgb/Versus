"use client";

import { useState } from "react";

import { Modal } from "@/components/modal";
export function UpsellModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [loadingPlan, setLoadingPlan] = useState<"MONTHLY" | "ANNUAL" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function subscribe(plan: "MONTHLY" | "ANNUAL") {
    setError(null);
    setLoadingPlan(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Une erreur est survenue.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
      setLoadingPlan(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      panelClassName="flex w-[460px] max-w-[90vw] flex-col gap-[22px] rounded-2xl bg-white p-9 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
    >
      <div className="flex items-baseline justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="font-serif text-[22px] font-semibold text-ink">
            Versus Upper
          </div>
          <div className="h-[3px] w-8 rounded bg-accent" />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="press-icon text-[15px] text-muted-light cursor-pointer"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>

      <div className="text-[13.5px] leading-[1.55] text-muted-light">
        Exercices illimités, deck de révision sans limite quotidienne, et ajout
        de cartes sans restriction.
      </div>

      <div className="flex gap-3.5">
        <button
          type="button"
          disabled={loadingPlan !== null}
          onClick={() => subscribe("MONTHLY")}
          className="press-card flex flex-1 flex-col gap-1.5 rounded-xl border border-border-strong p-5 text-left cursor-pointer disabled:cursor-wait"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.03em] text-muted-light">
            Mensuel
          </div>
          <div className="font-serif text-[26px] font-semibold text-ink">
            6,99&nbsp;€
            <span className="text-[13px] font-normal text-muted-light">
              &nbsp;/ mois
            </span>
          </div>
        </button>
        <button
          type="button"
          disabled={loadingPlan !== null}
          onClick={() => subscribe("ANNUAL")}
          className="press-card relative flex flex-1 flex-col gap-1.5 rounded-xl border-2 border-accent p-5 text-left cursor-pointer disabled:cursor-wait"
        >
          <div className="absolute -top-[11px] left-4 rounded-full bg-accent px-2.5 py-0.5 text-[10.5px] font-semibold text-white">
            -40%
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.03em] text-accent">
            Annuel
          </div>
          <div className="font-serif text-[26px] font-semibold text-ink">
            49,99&nbsp;€
            <span className="text-[13px] font-normal text-muted-light">
              &nbsp;/ an
            </span>
          </div>
        </button>
      </div>

      {error && <div className="text-[12.5px] text-danger">{error}</div>}

      <button
        type="button"
        onClick={onClose}
        className="press-link cursor-pointer text-center text-[12.5px] text-muted-light"
      >
        Continuer avec Versus gratuit
      </button>
    </Modal>
  );
}
