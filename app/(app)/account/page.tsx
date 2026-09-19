import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DeleteAccountButton } from "@/components/account/delete-account-button";
import { ManageSubscription } from "@/components/account/manage-subscription";

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  apple: "Apple",
};

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [account, subscription] = await Promise.all([
    prisma.account.findFirst({ where: { userId: session.user.id } }),
    prisma.subscription.findUnique({ where: { userId: session.user.id } }),
  ]);

  const providerLabel = account ? PROVIDER_LABELS[account.provider] ?? account.provider : "—";
  const plan = subscription?.plan ?? "FREE";
  const isPremium = plan !== "FREE" && subscription?.status === "ACTIVE";

  return (
    <div className="flex max-w-[640px] flex-col gap-7 py-12 px-16">
      <div className="font-serif text-[28px] font-semibold text-ink">Gestion du compte</div>

      <ManageSubscription plan={plan} isPremium={isPremium} />

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold text-ink-softer">Connexion</div>
          <div className="flex items-center justify-between rounded-lg border border-border-strong bg-white px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-[22px] w-[22px] items-center justify-center rounded-md bg-paper-alt-2 text-xs font-semibold text-ink-40">
                {providerLabel.charAt(0)}
              </div>
              <div className="text-[14.5px] text-ink-softer">
                Connecté avec {providerLabel}
                {session.user.email ? ` · ${session.user.email}` : ""}
              </div>
            </div>
            <div className="text-[12.5px] font-medium text-muted-light">
              Géré par {providerLabel}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-white px-6 py-5">
          <div className="text-sm font-semibold text-ink-softer">Se déconnecter</div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="cursor-pointer whitespace-nowrap rounded-lg border border-border-strong px-5 py-[11px] text-[13.5px] font-semibold text-ink-40"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="flex items-center justify-between rounded-xl bg-danger-bg border border-danger-border px-6 py-5">
        <div>
          <div className="text-sm font-semibold text-danger-strong">
            Supprimer mon compte
          </div>
          <div className="mt-1 max-w-[360px] text-[12.5px] text-[oklch(0.5_0.1_25)]">
            Action définitive : votre progression et vos decks seront supprimés.
          </div>
        </div>
        <DeleteAccountButton />
      </div>
    </div>
  );
}
