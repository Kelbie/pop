import { NDKEvent, type NDKKind } from "@nostr-dev-kit/ndk";
import { ndk } from "./ndk";

// A "Pop" (guestbook) is an addressable / parameterized-replaceable event
// (NIP-01 kind range 30000–39999) so a host can edit it in place and it can be
// referenced by an `naddr` (NIP-19). 31337 is Pop's own kind for guestbooks.
export const POP_KIND = 31337 as unknown as NDKKind;

export interface Pop {
  /** `d`-tag identifier, unique per host. */
  id: string;
  /** Event name (the `title` tag). */
  name: string;
  /** Description (the event content). */
  description: string;
  /** Host pubkey (hex). */
  host: string;
  /** Unix seconds the event was created. */
  createdAt: number;
  /** Shareable `naddr` bech32 reference (NIP-19). */
  naddr: string;
}

function toPop(event: NDKEvent): Pop {
  return {
    id: event.dTag ?? "",
    name: event.tagValue("title") ?? "Untitled",
    description: event.content,
    host: event.pubkey,
    createdAt: event.created_at ?? 0,
    naddr: event.encode(),
  };
}

/** Publish a new Pop guestbook signed by the current host. */
export async function createPop(input: {
  name: string;
  description: string;
}): Promise<Pop> {
  const event = new NDKEvent(ndk);
  event.kind = POP_KIND;
  event.tags = [
    // Fixed `d` → one guestbook per host; re-publishing edits it in place.
    ["d", "pop"],
    ["title", input.name],
    ["alt", `Pop guestbook: ${input.name}`],
  ];
  event.content = input.description;

  const relays = await event.publish();
  if (relays.size === 0) {
    throw new Error("No relay accepted the Pop. Check your relay connection.");
  }
  return toPop(event);
}

/** Fetch every Pop authored by the given host, newest first. */
export async function fetchPops(host: string): Promise<Pop[]> {
  const events = await ndk.fetchEvents({
    kinds: [POP_KIND],
    authors: [host],
    "#d": ["pop"],
  });

  // Addressable events: keep only the newest copy per `d` tag.
  const newest = new Map<string, NDKEvent>();
  for (const event of events) {
    const key = event.dTag ?? event.id;
    const existing = newest.get(key);
    if (!existing || (event.created_at ?? 0) > (existing.created_at ?? 0)) {
      newest.set(key, event);
    }
  }

  return [...newest.values()]
    .map(toPop)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Fetch every Pop across relays for the public, searchable homepage list. */
export async function fetchAllPops(limit = 200): Promise<Pop[]> {
  const events = await ndk.fetchEvents({ kinds: [POP_KIND], "#d": ["pop"], limit });

  // Addressable events: keep only the newest copy per host + `d` tag.
  const newest = new Map<string, NDKEvent>();
  for (const event of events) {
    const key = `${event.pubkey}:${event.dTag ?? event.id}`;
    const existing = newest.get(key);
    if (!existing || (event.created_at ?? 0) > (existing.created_at ?? 0)) {
      newest.set(key, event);
    }
  }

  return [...newest.values()]
    .map(toPop)
    .sort((a, b) => b.createdAt - a.createdAt);
}
