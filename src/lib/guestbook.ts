import {
  NDKEvent,
  type NDKKind,
  NDKPrivateKeySigner,
  nip19,
} from "@nostr-dev-kit/ndk";
import { ndk, RELAYS } from "./ndk";
import { POP_KIND, type Pop } from "./pop";
import type { Post, PostMedia } from "../types/post";

// A guestbook entry is a NIP-22 comment (kind 1111) scoped to the Pop event.
// Top-level entries point at the Pop with the uppercase root tags (E/K/P) and,
// since they aren't replies to another comment, repeat it as the parent (e/k/p).
export const ENTRY_KIND = 1111 as unknown as NDKKind;

const RELAY_HINT = RELAYS[0] ?? "";

/** Build a NIP-92 `imeta` tag for an image url. */
function imetaTag(url: string): string[] {
  return ["imeta", `url ${url}`, "m image/*"];
}

/**
 * Publish a guestbook entry (kind 1111) scoped to `pop`.
 *
 * - Logged-in: signed by the current `ndk.signer` (the visitor's Nostr account).
 * - Guest (`guest: true`): signed with a throwaway keypair generated in-browser,
 *   leaving any logged-in session untouched. The optional `name` is carried on
 *   the entry as a `["name", …]` tag so it renders instantly on the wall for
 *   everyone, and (for guests) mirrored into a best-effort kind-0 so the name
 *   also resolves in other Nostr clients.
 */
export async function createEntry(input: {
  pop: Pop;
  message: string;
  imageUrl?: string;
  name?: string;
  guest?: boolean;
}): Promise<Post> {
  const { pop, message, imageUrl, guest } = input;
  const name = input.name?.trim() || undefined;
  const kindStr = String(POP_KIND as unknown as number);

  const event = new NDKEvent(ndk);
  event.kind = ENTRY_KIND;
  event.content = message;
  event.tags = [
    // Root scope: the Pop event (uppercase tags).
    ["E", pop.id, RELAY_HINT, pop.host],
    ["K", kindStr],
    ["P", pop.host, RELAY_HINT],
    // Parent item: same as root for a top-level entry (lowercase tags).
    ["e", pop.id, RELAY_HINT, pop.host],
    ["k", kindStr],
    ["p", pop.host, RELAY_HINT],
  ];
  if (imageUrl) event.tags.push(imetaTag(imageUrl));
  if (name) event.tags.push(["name", name]);

  if (guest) {
    // Sign with a fresh ephemeral key so we never disturb ndk.signer.
    const signer = NDKPrivateKeySigner.generate();
    await event.sign(signer);
    if (name) void publishGuestProfile(signer, name);
  }

  const relays = await event.publish();
  if (relays.size === 0) {
    throw new Error("No relay accepted your entry. Check your relay connection.");
  }

  return {
    id: event.id,
    author: {
      pubkey: event.pubkey,
      displayName: name || shortName(event.pubkey),
    },
    message,
    media: imageUrl ? { url: imageUrl, type: "image" } : undefined,
    createdAt: event.created_at ?? Math.floor(Date.now() / 1000),
  };
}

/** Best-effort kind-0 for a guest's throwaway key so other clients show the name too. */
async function publishGuestProfile(
  signer: NDKPrivateKeySigner,
  name: string,
): Promise<void> {
  try {
    const meta = new NDKEvent(ndk);
    meta.kind = 0 as unknown as NDKKind;
    meta.content = JSON.stringify({ name, display_name: name });
    await meta.sign(signer);
    await meta.publish();
  } catch {
    /* non-critical — the ["name"] tag still drives in-app display */
  }
}

/** Pull the image url out of an entry's NIP-92 `imeta` tag, if present. */
function mediaFromEvent(event: NDKEvent): PostMedia | undefined {
  const imeta = event.tags.find((t) => t[0] === "imeta");
  if (!imeta) return undefined;
  const urlPart = imeta.slice(1).find((p) => p.startsWith("url "));
  const url = urlPart?.slice(4).trim();
  return url ? { url, type: "image" } : undefined;
}

function shortName(pubkey: string): string {
  try {
    return `${nip19.npubEncode(pubkey).slice(0, 10)}…`;
  } catch {
    return `${pubkey.slice(0, 8)}…`;
  }
}

/** Map a kind-1111 entry event to a Post, filling in the author's profile. */
async function toPost(event: NDKEvent): Promise<Post> {
  // A name supplied at sign time (mainly by guests) wins over the profile, and
  // renders without waiting on a kind-0 round trip.
  const nameTag = event.tags.find((t) => t[0] === "name")?.[1]?.trim();
  let displayName = nameTag || shortName(event.pubkey);
  let avatarUrl: string | undefined;
  let nip05: string | undefined;
  try {
    const profile = await ndk.getUser({ pubkey: event.pubkey }).fetchProfile();
    if (profile) {
      if (!nameTag) displayName = profile.displayName || profile.name || displayName;
      avatarUrl = profile.picture || profile.image || undefined;
      nip05 = profile.nip05 || undefined;
    }
  } catch {
    /* profile unavailable — fall back to the name tag or short npub */
  }

  return {
    id: event.id,
    author: { pubkey: event.pubkey, displayName, avatarUrl, nip05 },
    message: event.content,
    media: mediaFromEvent(event),
    createdAt: event.created_at ?? 0,
  };
}

/** Fetch every guestbook entry scoped to `pop`, newest first, with author profiles resolved. */
export async function loadEntries(pop: Pop): Promise<Post[]> {
  const events = await ndk.fetchEvents({
    kinds: [ENTRY_KIND],
    "#E": [pop.id],
  });
  const posts = await Promise.all([...events].map(toPost));
  return posts.sort((a, b) => b.createdAt - a.createdAt);
}
