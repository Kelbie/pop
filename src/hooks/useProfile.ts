import type { NDKUserProfile } from "@nostr-dev-kit/ndk";
import { useEffect, useState } from "react";
import { connectNdk, ndk } from "../lib/ndk";
import { shortNpub } from "../lib/pubkey";

/**
 * Fetch a Nostr profile by hex pubkey. Returns the raw profile plus the derived
 * display name and avatar so callers don't each re-implement the fallback chain.
 * Shared by the event top bar (host identity) and the donation panel.
 */
export function useProfile(hex: string | null | undefined) {
  const [profile, setProfile] = useState<NDKUserProfile | null>(null);

  useEffect(() => {
    if (!hex) return;
    let cancelled = false;
    connectNdk().then(() =>
      ndk
        .getUser({ pubkey: hex })
        .fetchProfile()
        .then((p) => !cancelled && setProfile(p))
        .catch(() => {}),
    );
    return () => {
      cancelled = true;
    };
  }, [hex]);

  const displayName =
    profile?.displayName || profile?.name || (hex ? shortNpub(hex) : "");
  const avatar = profile?.picture || profile?.image;

  return { profile, displayName, avatar };
}
