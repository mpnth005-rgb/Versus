"use client";

import { useState } from "react";

import { UpsellModal } from "@/components/upsell-modal";

const PLAN_LABELS: Record<string, string> = {
  FREE: "Versus gratuit",
  MONTHLY: "Versus Upper — mensuel",
  ANNUAL: "Versus Upper — annuel",
};

export function ManageSubscription({
  plan,
  isPremium,
}: {
  plan: "FREE" | "MONTHLY" | "ANNUAL";
  isPremium: boolean;
}) {
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Une erreur est survenue.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-semibold text-ink-softer">Abonnement</div>
      <div className="flex items-center justify-between rounded-xl border border-border bg-white px-6 py-5">
        <div className="text-sm text-ink-softer">{PLAN_LABELS[plan]}</div>
        {isPremium ? (
          <button
            type="button"
            onClick={openPortal}
            disabled={loading}
            className="cursor-pointer whitespace-nowrap rounded-lg border border-border-strong px-5 py-[11px] text-[13.5px] font-semibold text-ink-40 disabled:opacity-60"
          >
            Gérer l&apos;abonnement
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setUpsellOpen(true)}
            className="cursor-pointer whitespace-nowrap rounded-lg bg-ink px-5 py-[11px] text-[13.5px] font-semibold text-white"
          >
            Passer à Versus Upper
          </button>
        )}
      </div>
      {error && <div className="text-[12.5px] text-danger-text">{error}</div>}
      <UpsellModal open={upsellOpen} onClose={() => setUpsellOpen(false)} />
    </div>
  );
}
