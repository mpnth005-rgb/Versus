import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { getStripe, StripeNotConfiguredError } from "@/lib/stripe";

function planFromPriceId(priceId: string | null | undefined): "MONTHLY" | "ANNUAL" | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_MONTHLY) return "MONTHLY";
  if (priceId === process.env.STRIPE_PRICE_ANNUAL) return "ANNUAL";
  return null;
}

async function syncSubscriptionFromStripe(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  const priceId = subscription.items.data[0]?.price?.id;
  const plan = planFromPriceId(priceId) ?? "MONTHLY";
  const item = subscription.items.data[0];
  const currentPeriodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000)
    : null;

  const status =
    subscription.status === "active" || subscription.status === "trialing"
      ? "ACTIVE"
      : subscription.status === "past_due"
        ? "PAST_DUE"
        : subscription.status === "canceled" || subscription.status === "unpaid"
          ? "CANCELED"
          : "INCOMPLETE";

  await prisma.subscription.upsert({
    where: { userId },
    update: {
      plan,
      status,
      stripeCustomerId: String(subscription.customer),
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd,
    },
    create: {
      userId,
      plan,
      status,
      stripeCustomerId: String(subscription.customer),
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd,
    },
  });
}

export async function POST(req: NextRequest) {
  let stripe;
  try {
    stripe = getStripe();
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET n'est pas configuré." },
      { status: 503 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  const payload = await req.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("Missing stripe-signature header");
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    console.error("stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const checkoutSession = event.data.object;
      if (checkoutSession.subscription) {
        const subscription = await stripe.subscriptions.retrieve(
          String(checkoutSession.subscription)
        );
        await syncSubscriptionFromStripe(subscription);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      await syncSubscriptionFromStripe(event.data.object);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const userId = subscription.metadata?.userId;
      if (userId) {
        await prisma.subscription.updateMany({
          where: { userId },
          data: { plan: "FREE", status: "CANCELED", stripeSubscriptionId: null },
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
