import { SignJWT, importPKCS8 } from "jose";

/**
 * Apple requires the OAuth `client_secret` to be a short-lived JWT signed
 * with your Sign in with Apple private key, rather than a static secret.
 * Given APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY / APPLE_CLIENT_ID,
 * we mint one ourselves instead of asking whoever deploys this app to
 * regenerate a static secret every few months.
 *
 * If AUTH_APPLE_SECRET is set directly (e.g. generated via `npx auth add
 * apple`), it takes precedence and is returned as-is.
 */
let cached: { token: string; expiresAt: number } | null = null;

export async function getAppleClientSecret(): Promise<string | undefined> {
  if (process.env.AUTH_APPLE_SECRET) return process.env.AUTH_APPLE_SECRET;

  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY;
  const clientId = process.env.AUTH_APPLE_ID;

  if (!teamId || !keyId || !privateKey || !clientId) return undefined;

  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - now > 60) return cached.token;

  const pkcs8 = privateKey.includes("BEGIN PRIVATE KEY")
    ? privateKey.replace(/\\n/g, "\n")
    : `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;

  const key = await importPKCS8(pkcs8, "ES256");
  const expiresAt = now + 60 * 60 * 24 * 30; // 30 days; Apple allows up to 6 months

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .setAudience("https://appleid.apple.com")
    .setSubject(clientId)
    .sign(key);

  cached = { token, expiresAt };
  return token;
}
