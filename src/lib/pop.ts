import { NDKEvent, type NDKKind, nip19 } from "@nostr-dev-kit/ndk";
import { ndk, RELAYS } from "./ndk";

// A "Pop" (guestbook) is a regular event (NIP-01 kind range 1000–9999) so each
// one is a distinct, immutable note addressable by its event id and shareable
// as an `nevent` (NIP-19). 1338 is Pop's own kind for guestbooks.
export const POP_KIND = 1338 as unknown as NDKKind;

export interface Pop {
  /** The Nostr event id (hex). */
  id: string;
  /** Event name (the `title` tag). */
  name: string;
  /** Description (the event content). */
  description: string;
  /** Host pubkey (hex) — the author of the Pop. */
  host: string;
  /** Unix seconds the event was created. */
  createdAt: number;
  /** Shareable `nevent` bech32 reference (NIP-19), with relay + author hints. */
  nevent: string;
}

/** Encode a Pop event as an `nevent` with relay + author + kind hints. */
function encodeNevent(event: NDKEvent): string {
  return nip19.neventEncode({
    id: event.id,
    author: event.pubkey,
    kind: POP_KIND as unknown as number,
    relays: RELAYS,
  });
}

function toPop(event: NDKEvent): Pop {
  return {
    id: event.id,
    name: event.tagValue("title") ?? "Untitled",
    description: event.content,
    host: event.pubkey,
    createdAt: event.created_at ?? 0,
    nevent: encodeNevent(event),
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
    ["title", input.name],
    ["alt", `Pop guestbook: ${input.name}`],
    ["t", "pop"],
  ];
  event.content = input.description;

  const relays = await event.publish();
  if (relays.size === 0) {
    throw new Error("No relay accepted the Pop. Check your relay connection.");
  }
  return toPop(event);
}

/** Fetch a single Pop by its event id, or null if it can't be found. */
export async function fetchPop(id: string): Promise<Pop | null> {
  const event = await ndk.fetchEvent({ ids: [id], kinds: [POP_KIND] });
  return event ? toPop(event) : null;
}

/** Fetch every Pop authored by the given host, newest first. */
export async function fetchPops(host: string): Promise<Pop[]> {
  const events = await ndk.fetchEvents({ kinds: [POP_KIND], authors: [host] });

  return [...events]
    .map(toPop)
    .sort((a, b) => b.createdAt - a.createdAt);
}
