import { nip19 } from "@nostr-dev-kit/ndk";

/** An event reference resolved from a route param (`nevent…` or `note…`). */
export interface ParsedNevent {
  /** The 32-byte event id (hex). */
  id: string;
  /** Author pubkey hint (hex), if the nevent carried one. */
  author?: string;
  /** Relay hints, if any. */
  relays: string[];
  /** Event kind hint, if the nevent carried one. */
  kind?: number;
}

/**
 * Accept an `nevent1…` (with id + optional author/relay/kind hints) or a bare
 * `note1…` (id only) and return the decoded event reference, or null when the
 * input is neither.
 */
export function parseNeventParam(param: string): ParsedNevent | null {
  const value = param.trim();
  try {
    const decoded = nip19.decode(value);
    if (decoded.type === "nevent") {
      const d = decoded.data;
      return {
        id: d.id,
        author: d.author ?? undefined,
        relays: d.relays ?? [],
        kind: d.kind ?? undefined,
      };
    }
    if (decoded.type === "note") {
      return { id: decoded.data, relays: [] };
    }
  } catch {
    return null;
  }
  return null;
}
