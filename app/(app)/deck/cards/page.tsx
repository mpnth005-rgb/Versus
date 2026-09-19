import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatShortDate, formatDueRelative } from "@/lib/format";
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

  const cards = await prisma.flashcard.findMany({
    where: { userId: session.user.id },
    orderBy: { [sortField]: sortDir },
  });

  const otherDir = sortDir === "asc" ? "desc" : "asc";

  return (
    <div className="flex flex-col gap-6 py-12 px-16">
      <div className="flex items-center justify-between">
        <div className="font-serif text-[28px] font-semibold text-ink">Cartes du deck</div>
        <div className="text-[13px] text-muted-light">
          {cards.length} carte{cards.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Link
          href="/deck/cards/new"
          className="flex cursor-pointer items-center gap-2 rounded-lg bg-ink px-4.5 py-2.5 text-[13px] font-semibold text-white"
        >
          <span className="text-[15px]">+</span>Ajouter une carte
        </Link>
        <div className="flex items-center gap-2 text-[12.5px] text-muted-light">
          <span>Trier par</span>
          <div className="flex overflow-hidden rounded-lg border border-border-strong">
            <Link
              href={`/deck/cards?sort=created&dir=${sortField === "createdAt" ? otherDir : "desc"}`}
              className={
                "px-3 py-1.5 font-medium " +
                (sortField === "createdAt" ? "bg-ink text-white" : "bg-white text-ink-40")
              }
            >
              CRÉÉE
            </Link>
            <Link
              href={`/deck/cards?sort=due&dir=${sortField === "dueAt" ? otherDir : "asc"}`}
              className={
                "px-3 py-1.5 font-medium " +
                (sortField === "dueAt" ? "bg-ink text-white" : "bg-white text-ink-40")
              }
            >
              DUE
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-white">
        <div className="grid grid-cols-[2.3fr_2.3fr_1fr_1.2fr_68px] bg-paper-alt px-6 py-3.5 text-[11.5px] font-semibold uppercase text-muted-light">
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
          cards.map((card) => (
            <div
              key={card.id}
              className="grid grid-cols-[2.3fr_2.3fr_1fr_1.2fr_68px] items-center border-t border-border-soft px-6 py-4 text-[13.5px]"
            >
              <div className="pr-4 text-ink-softer">{card.front}</div>
              <div className="pr-4 text-ink-45">{card.back}</div>
              <div className="text-muted-light">{formatShortDate(card.createdAt)}</div>
              <div className="text-muted-light">{formatDueRelative(card.dueAt)}</div>
              <div className="flex justify-end gap-2">
                <Link
                  href={`/deck/cards/${card.id}/edit`}
                  title="Modifier"
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-border-strong text-[11px] text-ink-40"
                >
                  ✎
                </Link>
                <DeleteCardButton cardId={card.id} />
              </div>
            </div>
          ))
        )}
      </div>

      <Link href="/deck" className="text-[13px] font-medium text-ink-40">
        ← Retour à la session de révision
      </Link>
    </div>
  );
}
