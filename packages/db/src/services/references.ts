import { randomBytes, createHash } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity

/** Opaque, non-sequential public reference shown to visitors. Carries no personal data. */
export function newPublicReference(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return `CG-${out.slice(0, 4)}-${out.slice(4)}`;
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Stable digest of the parts of a submission that must match for an idempotent replay. */
export function requestDigest(parts: Record<string, unknown>): string {
  const canonical = JSON.stringify(sortKeys(parts));
  return sha256(canonical);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}
