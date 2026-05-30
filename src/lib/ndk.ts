import NDK from "@nostr-dev-kit/ndk";

const RELAYS = (import.meta.env.VITE_RELAYS ?? "wss://relay.damus.io,wss://nos.lol")
  .split(",")
  .map((r: string) => r.trim())
  .filter(Boolean);

export const ndk = new NDK({ explicitRelayUrls: RELAYS });

let connected: Promise<void> | null = null;

export function connectNdk(): Promise<void> {
  if (!connected) connected = ndk.connect();
  return connected;
}
