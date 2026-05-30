import NDK from "@nostr-dev-kit/ndk";

/** Relays we connect to, advertise as nevent hints, and read events from. */
export const RELAYS: string[] = (
  import.meta.env.VITE_RELAYS ?? "wss://relay.damus.io,wss://nos.lol"
)
  .split(",")
  .map((r: string) => r.trim())
  .filter(Boolean);

export const ndk = new NDK({ explicitRelayUrls: RELAYS });

let connected: Promise<void> | null = null;

export function connectNdk(): Promise<void> {
  if (!connected) connected = ndk.connect();
  return connected;
}
