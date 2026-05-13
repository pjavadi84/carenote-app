import crypto from "node:crypto";

// 256-bit random token. The unsigned value is returned once to the caller (so
// it can be embedded in the confirmation email link); only the SHA-256 hash
// is persisted. This mirrors the clinician magic-link pattern in
// /api/share/clinician — see 00005_clinicians.sql.
export function generateConfirmationToken(): {
  unsigned: string;
  hash: string;
} {
  const unsigned = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(unsigned).digest("hex");
  return { unsigned, hash };
}

export function hashConfirmationToken(unsigned: string): string {
  return crypto.createHash("sha256").update(unsigned).digest("hex");
}

// Default expiry. 30 days is long enough for a family member to notice the
// email in their other inbox, but short enough that a stale link from a
// previous typo cannot be redeemed indefinitely. Shorter than the clinician
// 14-day default because family contacts are expected to act quickly; longer
// because they're less time-sensitive than a clinical hand-off.
export const CONFIRMATION_EXPIRY_DAYS = 30;

export function defaultExpiresAt(): Date {
  return new Date(Date.now() + CONFIRMATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}
