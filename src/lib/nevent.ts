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

/**
 * Build an `nevent1…` for an event, carrying author + kind + relay hints so it
 * resolves reliably in other clients (matching how we encode Pop events).
 */
export function encodeEventNevent(opts: {
  id: string;
  author?: string;
  kind?: number;
  relays?: string[];
}): string {
  return nip19.neventEncode({
    id: opts.id,
    author: opts.author,
    kind: opts.kind,
    // A couple of hints is plenty; more just bloats the string.
    relays: opts.relays?.filter(Boolean).slice(0, 2),
  });
}

/** A web URL to view an event on nostr.com (an njump-style universal viewer). */
export function nostrComEventUrl(opts: {
  id: string;
  author?: string;
  kind?: number;
  relays?: string[];
}): string {
  return `https://nostr.com/${encodeEventNevent(opts)}`;
}
