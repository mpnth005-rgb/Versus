import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CardForm } from "@/components/deck/card-form";

export default async function EditCardPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { cardId } = await params;
  const card = await prisma.flashcard.findUnique({ where: { id: cardId } });
  if (!card || card.userId !== session.user.id) notFound();

  return (
    <CardForm mode="edit" cardId={card.id} initialFront={card.front} initialBack={card.back} />
  );
}
