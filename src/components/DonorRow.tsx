import type { NDKUserProfile } from "@nostr-dev-kit/ndk";
import { useEffect, useState } from "react";
import { ndk } from "../lib/ndk";
import { shortNpub } from "../lib/pubkey";
import type { Donation } from "../hooks/useDonations";

const fmt = new Intl.NumberFormat("en-US");

export function DonorRow({ donation }: { donation: Donation }) {
  const [profile, setProfile] = useState<NDKUserProfile | null>(null);
  const { senderHex } = donation;

  useEffect(() => {
    if (!senderHex) return;
    let cancelled = false;
    ndk
      .getUser({ pubkey: senderHex })
      .fetchProfile()
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [senderHex]);

  const name = senderHex
    ? profile?.displayName || profile?.name || shortNpub(senderHex)
    : "Anonymous";
  const avatar = profile?.picture || profile?.image;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {avatar ? (
          <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-xs font-semibold text-neutral-300">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="truncate text-sm text-neutral-200">{name}</span>
      </div>
      <span className="shrink-0 font-mono text-sm font-semibold text-amber-400">
        {fmt.format(Math.round(donation.sats))} sats
      </span>
    </div>
  );
}
