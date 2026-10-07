import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getHistory } from "@/lib/progress";
import { TEXT_TYPE_LABELS, LEVEL_LABELS } from "@/lib/constants";
import { formatScore, formatShortDate } from "@/lib/format";

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const history = await getHistory(session.user.id);

  return (
    // Exactly one screen tall: the table shrinks so the page itself never
    // scrolls, and only its rows do.
    <div className="flex h-full flex-col gap-6 py-12 px-16">
      <div className="shrink-0">
        <Link href="/progress" className="press-link text-[13px] font-medium text-ink-40">
          ← Retour à la progression
        </Link>
        <div className="mt-3 font-serif text-[30px] font-semibold text-ink">
          Historique des exercices
        </div>
      </div>

      <div className="flex min-h-[200px] flex-col overflow-hidden rounded-xl border border-border bg-white">
        <div className="grid shrink-0 grid-cols-[2.2fr_1.6fr_1fr_1fr] bg-paper-alt px-6 py-3.5 text-xs font-semibold uppercase text-muted-light">
          <div>Titre</div>
          <div>Critères</div>
          <div>Score</div>
          <div>Date</div>
        </div>
        {history.length === 0 ? (
          <div className="px-6 py-8 text-center text-[13.5px] text-muted-light">
            Aucune session terminée pour le moment.
          </div>
        ) : (
          // Rows are 53px (py-4 + 20px line + 1px border): at most 10 show,
          // fewer on a short screen, and the rest scroll.
          <div className="max-h-[530px] min-h-0 overflow-y-auto">
            {history.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-[2.2fr_1.6fr_1fr_1fr] items-center border-t border-border-soft px-6 py-4 text-sm"
              >
                <div className="truncate pr-4 text-ink-softer" title={s.title}>
                  {s.title}
                </div>
                <div className="text-muted-light">
                  {TEXT_TYPE_LABELS[s.textType]} · {LEVEL_LABELS[s.level]}
                </div>
                <div className="font-semibold text-accent">{formatScore(s.score)}/20</div>
                <div className="text-muted-light">{formatShortDate(s.createdAt)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
