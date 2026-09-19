import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, StripeNotConfiguredError, STRIPE_PRICE_IDS } from "@/lib/stripe";

const bodySchema = z.object({
  plan: z.enum(["MONTHLY", "ANNUAL"]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const { plan } = parsed.data;
  const priceId = STRIPE_PRICE_IDS[plan];
  if (!priceId) {
    return NextResponse.json(
      { error: `STRIPE_PRICE_${plan} n'est pas configuré.` },
      { status: 503 }
    );
  }

  try {
    const stripe = getStripe();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    let stripeCustomerId = subscription?.stripeCustomerId ?? undefined;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: user.name ?? undefined,
        metadata: { userId: user.id },
      });
      stripeCustomerId = customer.id;
      await prisma.subscription.upsert({
        where: { userId: user.id },
        update: { stripeCustomerId },
        create: { userId: user.id, stripeCustomerId },
      });
    }

    const origin = req.nextUrl.origin;
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/account?checkout=success`,
      cancel_url: `${origin}/account?checkout=cancelled`,
      metadata: { userId: user.id, plan },
      subscription_data: { metadata: { userId: user.id, plan } },
    });

    if (!checkoutSession.url) {
      return NextResponse.json(
        { error: "Impossible de créer la session de paiement." },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("checkout error", error);
    return NextResponse.json({ error: "Une erreur est survenue." }, { status: 500 });
  }
}
