import { nip19 } from "@nostr-dev-kit/ndk";

/** A recipient identity resolved from a route param. */
export interface ParsedPubkey {
  hex: string;
  npub: string;
}

/**
 * Accepts either a hex pubkey or an `npub1…` string and returns both forms.
 * Returns null when the input is neither a valid npub nor a 64-char hex key.
 */
export function parsePubkeyParam(id: string): ParsedPubkey | null {
  const value = id.trim();

  if (value.startsWith("npub1")) {
    try {
      const decoded = nip19.decode(value);
      if (decoded.type === "npub") {
        return { hex: decoded.data, npub: value };
      }
    } catch {
      return null;
    }
    return null;
  }

  if (/^[0-9a-f]{64}$/i.test(value)) {
    const hex = value.toLowerCase();
    try {
      return { hex, npub: nip19.npubEncode(hex) };
    } catch {
      return null;
    }
  }

  return null;
}

/** Shorten an npub for display, e.g. `npub1abcd…wxyz`. */
export function shortNpub(pubkey: string): string {
  try {
    const npub = nip19.npubEncode(pubkey);
    return `${npub.slice(0, 10)}…${npub.slice(-4)}`;
  } catch {
    return `${pubkey.slice(0, 8)}…`;
  }
}
