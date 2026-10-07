import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatShortDate, formatDueRelative } from "@/lib/format";
import { getUserQuota } from "@/lib/quota";
import { AddCardButton } from "@/components/deck/add-card-button";
import { DeleteCardButton } from "@/components/deck/delete-card-button";

export default async function DeckCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { sort, dir } = await searchParams;
  const sortField = sort === "due" ? "dueAt" : "createdAt";
  const sortDir = dir === "asc" ? "asc" : "desc";

  const [cards, quota] = await Promise.all([
    prisma.flashcard.findMany({
      where: { userId: session.user.id },
      orderBy: { [sortField]: sortDir },
    }),
    getUserQuota(session.user.id),
  ]);

  const otherDir = sortDir === "asc" ? "desc" : "asc";
  // ↓ = oldest/soonest first, ↑ = reversed (as in the prototype).
  const arrow = sortDir === "asc" ? " ↓" : " ↑";

  return (
    <div className="flex h-full flex-col gap-6 py-12 px-16">
      <div className="flex shrink-0 items-center justify-between">
        <div className="font-serif text-[28px] font-semibold text-ink">Cartes du deck</div>
        <div className="text-[13px] text-muted-light">
          {cards.length} carte{cards.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between">
        <AddCardButton isPremium={quota.isPremium} />
        <div className="flex items-center gap-2 text-[12.5px] text-muted-light">
          <span>Trier par</span>
          <div className="flex overflow-hidden rounded-lg border border-border-strong">
            <Link
              href={`/deck/cards?sort=created&dir=${sortField === "createdAt" ? otherDir : "desc"}`}
              className={
                "press-chip px-3 py-1.5 " +
                (sortField === "createdAt"
                  ? "bg-ink font-semibold text-white"
                  : "bg-white font-medium text-ink-40")
              }
            >
              CRÉÉE{sortField === "createdAt" && arrow}
            </Link>
            <Link
              href={`/deck/cards?sort=due&dir=${sortField === "dueAt" ? otherDir : "asc"}`}
              className={
                "press-chip px-3 py-1.5 " +
                (sortField === "dueAt"
                  ? "bg-ink font-semibold text-white"
                  : "bg-white font-medium text-ink-40")
              }
            >
              DUE{sortField === "dueAt" && arrow}
            </Link>
          </div>
        </div>
      </div>

      <div className="flex min-h-[180px] flex-col overflow-hidden rounded-xl border border-border bg-white">
        <div className="grid shrink-0 grid-cols-[2.3fr_2.3fr_1fr_1.2fr_68px] bg-paper-alt px-6 py-3.5 text-[11.5px] font-semibold uppercase text-muted-light">
          <div>Recto</div>
          <div>Verso</div>
          <div>Créée</div>
          <div>Due</div>
          <div />
        </div>
        {cards.length === 0 ? (
          <div className="px-6 py-8 text-center text-[13.5px] text-muted-light">
            Aucune carte pour le moment.
          </div>
        ) : (
          // The page is exactly one screen tall (h-full inside the shell's
          // h-screen scroller): the table shrinks to leave room for the
          // "Retour" link and the bottom margin, and its rows scroll.
          <div className="min-h-0 overflow-y-auto">
            {cards.map((card) => (
              <div
                key={card.id}
                className="grid grid-cols-[2.3fr_2.3fr_1fr_1.2fr_68px] items-center border-t border-border-soft px-6 py-4 text-[13.5px] transition-colors duration-150 hover:bg-[oklch(0.99_0.003_90)]"
              >
                <div className="pr-4 text-ink-softer">{card.front}</div>
                <div className="pr-4 text-ink-45">{card.back}</div>
                <div className="text-muted-light">{formatShortDate(card.createdAt)}</div>
                <div className="text-muted-light">{formatDueRelative(card.dueAt)}</div>
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/deck/cards/${card.id}/edit`}
                    title="Modifier"
                    className="press-secondary flex h-6 w-6 items-center justify-center rounded-md border border-border-strong text-[11px] text-ink-40"
                  >
                    ✎
                  </Link>
                  <DeleteCardButton cardId={card.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Link href="/deck" className="press-link shrink-0 text-[13px] font-medium text-ink-40">
        ← Retour à la session de révision
      </Link>
    </div>
  );
}
