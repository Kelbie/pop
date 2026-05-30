import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { useEffect, useRef, useState } from "react";
import { connectNdk, ndk } from "../lib/ndk";
import { fetchZapServerPubkey, toNpub } from "../lib/npubcash";

export interface Donation {
  /** Zap receipt (kind 9735) event id. */
  id: string;
  /** Sender pubkey (hex) from the zap request, or null for anonymous/unknown. */
  senderHex: string | null;
  sats: number;
  createdAt: number;
}

export interface DonationsState {
  totalSats: number;
  count: number;
  donations: Donation[];
  loading: boolean;
}

/** Parse a kind-9735 receipt into a Donation, or null if it carries no readable amount. */
function parseReceipt(event: NDKEvent): Donation | null {
  const description = event.tags.find((t) => t[0] === "description")?.[1];
  if (!description) return null;

  let zapRequest: { pubkey?: string; tags?: string[][] };
  try {
    zapRequest = JSON.parse(description);
  } catch {
    return null;
  }

  const amountTag = zapRequest.tags?.find((t) => t[0] === "amount")?.[1];
  if (!amountTag) return null;
  const sats = Number(amountTag) / 1000;
  if (!Number.isFinite(sats) || sats <= 0) return null;

  // Sender: prefer the zap request author; fall back to the receipt's uppercase-P tag.
  const senderHex =
    zapRequest.pubkey ?? event.tags.find((t) => t[0] === "P")?.[1] ?? null;

  return { id: event.id, senderHex, sats, createdAt: event.created_at ?? 0 };
}

/**
 * Subscribe to NIP-57 zap receipts (kind 9735) addressed to `recipientHex` and keep a live running
 * total + donor list. Only receipts signed by the npub.cash service key are counted (when that key is
 * known), so the total cannot be inflated by forged receipts.
 */
export function useDonations(recipientHex: string | null): DonationsState {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Reset for this recipient (runs synchronously before the first await).
      seen.current = new Set();
      setDonations([]);
      if (!recipientHex) {
        setLoading(false);
        return undefined;
      }
      setLoading(true);

      await connectNdk();
      // The LNURL endpoint is keyed by npub; convert from the hex recipient.
      const serverPubkey = await fetchZapServerPubkey(
        toNpub(recipientHex),
      ).catch(() => null);
      if (cancelled) return;

      const sub = ndk.subscribe(
        { kinds: [9735], "#p": [recipientHex] },
        { closeOnEose: false },
      );

      sub.on("event", (event: NDKEvent) => {
        if (cancelled) return;
        // Authenticity: when we know the service key, ignore receipts not signed by it.
        if (serverPubkey && event.pubkey !== serverPubkey) return;
        if (seen.current.has(event.id)) return;

        const donation = parseReceipt(event);
        if (!donation) return;
        seen.current.add(event.id);
        setDonations((prev) =>
          [...prev, donation].sort((a, b) => b.createdAt - a.createdAt),
        );
      });

      sub.on("eose", () => {
        if (!cancelled) setLoading(false);
      });

      return sub;
    };

    const subPromise = run();

    return () => {
      cancelled = true;
      void subPromise.then((sub) => sub?.stop());
    };
  }, [recipientHex]);

  const totalSats = donations.reduce((sum, d) => sum + d.sats, 0);
  return { totalSats, count: donations.length, donations, loading };
}
