import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
});

async function assertOwnership(userId: string, cardId: string) {
  const card = await prisma.flashcard.findUnique({ where: { id: cardId } });
  return card && card.userId === userId ? card : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { cardId } = await params;
  const card = await assertOwnership(session.user.id, cardId);
  if (!card) return NextResponse.json({ error: "Carte introuvable." }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  await prisma.flashcard.update({
    where: { id: cardId },
    data: { front: parsed.data.front, back: parsed.data.back },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { cardId } = await params;
  const card = await assertOwnership(session.user.id, cardId);
  if (!card) return NextResponse.json({ error: "Carte introuvable." }, { status: 404 });

  await prisma.flashcard.delete({ where: { id: cardId } });
  return NextResponse.json({ ok: true });
}
