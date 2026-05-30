import { NDKEvent, nip19 } from "@nostr-dev-kit/ndk";
import { finalizeEvent, generateSecretKey, nip57 } from "nostr-tools";
import { ndk } from "./ndk";

/** The Lightning-address domain served by npub.cash (override via VITE_NPUBCASH_DOMAIN). */
export const NPUBCASH_DOMAIN =
  import.meta.env.VITE_NPUBCASH_DOMAIN ?? "npubx.cash";

/** Relays we both advertise in zap requests and read receipts from, so receipts land where we look. */
export const ZAP_RELAYS = (ndk.explicitRelayUrls?.length
  ? ndk.explicitRelayUrls
  : ["wss://relay.damus.io", "wss://nos.lol"]
).concat("wss://relay.primal.net");

/** `<npub>@<domain>` Lightning address for a recipient. */
export function lightningAddress(npub: string): string {
  return `${npub}@${NPUBCASH_DOMAIN}`;
}

interface LnurlPayMetadata {
  allowsNostr?: boolean;
  nostrPubkey?: string;
  callback?: string;
  minSendable?: number;
  maxSendable?: number;
}

/**
 * Fetch the LNURL-pay metadata for `<npub>@<domain>` and return the service's zap-receipt signing
 * pubkey. We only count kind-9735 receipts signed by this key, so fake receipts can't inflate a total.
 */
export async function fetchZapServerPubkey(npub: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://${NPUBCASH_DOMAIN}/.well-known/lnurlp/${npub}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as LnurlPayMetadata;
    return data.allowsNostr && data.nostrPubkey ? data.nostrPubkey : null;
  } catch {
    return null;
  }
}

/**
 * Ask npub.cash for a bolt11 invoice for a zap of `msats` to `npub`, attaching the signed zap request.
 * Mirrors the call in nut-november's donate page.
 */
export async function fetchZapInvoice(
  npub: string,
  msats: number,
  signedZapRequest: object,
): Promise<string> {
  const url =
    `https://${NPUBCASH_DOMAIN}/.well-known/lnurlp/${npub}` +
    `?amount=${msats}&nostr=${encodeURIComponent(JSON.stringify(signedZapRequest))}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`npub.cash returned ${res.status}`);
  const data = (await res.json()) as { pr?: string; reason?: string };
  if (!data.pr) throw new Error(data.reason ?? "No invoice returned");
  return data.pr;
}

export interface ZapRequestResult {
  /** The signed kind-9734 event (raw JSON form) to hand to the LNURL endpoint. */
  signed: object;
  /** The event id, used to match the resulting kind-9735 receipt. */
  id: string;
  /** True when signed with the logged-in user's key (attributed), false for an ephemeral key. */
  attributed: boolean;
}

/**
 * Build and sign a NIP-57 zap request (kind 9734) for `recipientHex`.
 * If a signer is logged in, sign with it so the donation is attributed to that npub; otherwise sign
 * with a throwaway key (anonymous).
 */
export async function buildSignedZapRequest(params: {
  recipientHex: string;
  msats: number;
  comment?: string;
}): Promise<ZapRequestResult> {
  const template = nip57.makeZapRequest({
    pubkey: params.recipientHex,
    amount: params.msats,
    relays: ZAP_RELAYS,
    comment: params.comment ?? "",
  });

  if (ndk.signer) {
    const event = new NDKEvent(ndk);
    event.kind = template.kind;
    event.created_at = template.created_at;
    event.tags = template.tags;
    event.content = template.content;
    await event.sign();
    const raw = event.rawEvent();
    return { signed: raw, id: raw.id as string, attributed: true };
  }

  const signed = finalizeEvent(template, generateSecretKey());
  return { signed, id: signed.id, attributed: false };
}

/** Decode the recipient hex pubkey to an npub (thin re-export to avoid importing nip19 everywhere). */
export function toNpub(hex: string): string {
  return nip19.npubEncode(hex);
}
