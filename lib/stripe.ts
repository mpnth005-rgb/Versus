import Stripe from "stripe";

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("STRIPE_SECRET_KEY is not set — billing is unavailable.");
    this.name = "StripeNotConfiguredError";
  }
}

let client: Stripe | null | undefined;

export function getStripe(): Stripe {
  if (client === undefined) {
    const key = process.env.STRIPE_SECRET_KEY;
    client = key ? new Stripe(key) : null;
  }
  if (!client) throw new StripeNotConfiguredError();
  return client;
}

export const STRIPE_PRICE_IDS = {
  MONTHLY: process.env.STRIPE_PRICE_MONTHLY,
  ANNUAL: process.env.STRIPE_PRICE_ANNUAL,
} as const;
