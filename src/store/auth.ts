import {
  NDKNip07Signer,
  NDKNip46Signer,
  NDKPrivateKeySigner,
  ndkSignerFromPayload,
  type NDKSigner,
  type NDKUserProfile,
} from "@nostr-dev-kit/ndk";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ndk } from "../lib/ndk";

export type LoginMethod = "extension" | "bunker" | "nsec";

/** Relay used to broker the nostrconnect:// handshake. */
export const DEFAULT_NOSTRCONNECT_RELAY = "wss://relay.nsec.app";

/** Metadata advertised to the remote signer during a nostrconnect:// flow. */
const NOSTRCONNECT_OPTS = {
  name: "Pop",
  url: typeof window !== "undefined" ? window.location.origin : undefined,
  perms: "sign_event:1,nip44_encrypt,nip44_decrypt",
};

interface AuthState {
  status: "anonymous" | "connecting" | "authenticated";
  pubkey: string | null;
  method: LoginMethod | null;
  /** Serialized signer (NDK `toPayload()`) — the only thing we persist to rebuild the session. */
  signerPayload: string | null;
  profile: NDKUserProfile | null;

  loginWithExtension: () => Promise<void>;
  loginWithNsec: (nsec: string) => Promise<void>;
  loginWithBunkerUrl: (uri: string) => Promise<void>;
  /** Begins a nostrconnect:// flow: returns the URI to render as a QR plus a promise that resolves on connect. */
  startNostrConnect: (relay?: string) => { uri: string; ready: Promise<void> };
  logout: () => void;
  /** Rebuild the live signer from the persisted payload after a reload. */
  restore: () => Promise<void>;
}

/** Wire a ready signer into NDK and update the store, then fetch the profile in the background. */
async function activate(
  set: (partial: Partial<AuthState>) => void,
  signer: NDKSigner,
  method: LoginMethod,
) {
  ndk.signer = signer;
  const user = await signer.blockUntilReady();
  const pubkey = user.pubkey;

  set({
    status: "authenticated",
    pubkey,
    method,
    signerPayload: signer.toPayload(),
    profile: null,
  });

  // Best-effort profile fetch for the header chip; never blocks login.
  void ndk
    .getUser({ pubkey })
    .fetchProfile()
    .then((profile) => {
      if (profile && useAuthStore.getState().pubkey === pubkey) {
        useAuthStore.setState({ profile });
      }
    })
    .catch(() => {});
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      status: "anonymous",
      pubkey: null,
      method: null,
      signerPayload: null,
      profile: null,

      loginWithExtension: async () => {
        if (typeof window === "undefined" || !window.nostr) {
          throw new Error("No Nostr extension detected.");
        }
        set({ status: "connecting" });
        try {
          await activate(set, new NDKNip07Signer(), "extension");
        } catch (err) {
          set({ status: get().pubkey ? "authenticated" : "anonymous" });
          throw err;
        }
      },

      loginWithNsec: async (nsec) => {
        const trimmed = nsec.trim();
        if (!trimmed.startsWith("nsec1")) {
          throw new Error('Invalid key — a private key starts with "nsec1".');
        }
        set({ status: "connecting" });
        try {
          // NDK accepts the nsec string directly; do not decode it first.
          await activate(set, new NDKPrivateKeySigner(trimmed), "nsec");
        } catch (err) {
          set({ status: get().pubkey ? "authenticated" : "anonymous" });
          throw err;
        }
      },

      loginWithBunkerUrl: async (uri) => {
        const trimmed = uri.trim();
        if (!trimmed.startsWith("bunker://")) {
          throw new Error('Invalid bunker URL — it should start with "bunker://".');
        }
        set({ status: "connecting" });
        try {
          await activate(set, NDKNip46Signer.bunker(ndk, trimmed), "bunker");
        } catch (err) {
          set({ status: get().pubkey ? "authenticated" : "anonymous" });
          throw err;
        }
      },

      startNostrConnect: (relay = DEFAULT_NOSTRCONNECT_RELAY) => {
        const signer = NDKNip46Signer.nostrconnect(
          ndk,
          relay,
          undefined,
          NOSTRCONNECT_OPTS,
        );
        set({ status: "connecting" });
        const ready = activate(set, signer, "bunker").catch((err) => {
          set({ status: get().pubkey ? "authenticated" : "anonymous" });
          throw err;
        });
        return { uri: signer.nostrConnectUri ?? "", ready };
      },

      logout: () => {
        ndk.signer = undefined;
        set({
          status: "anonymous",
          pubkey: null,
          method: null,
          signerPayload: null,
          profile: null,
        });
      },

      restore: async () => {
        const { signerPayload } = get();
        if (!signerPayload) return;
        set({ status: "connecting" });
        try {
          const signer = await ndkSignerFromPayload(signerPayload, ndk);
          if (!signer) throw new Error("Unknown signer payload");
          ndk.signer = signer;
          const user = await signer.blockUntilReady();
          set({ status: "authenticated", pubkey: user.pubkey });
          void ndk
            .getUser({ pubkey: user.pubkey })
            .fetchProfile()
            .then((profile) => {
              if (profile && get().pubkey === user.pubkey) set({ profile });
            })
            .catch(() => {});
        } catch {
          // Stale/unreconnectable session — drop it and stay anonymous.
          ndk.signer = undefined;
          set({
            status: "anonymous",
            pubkey: null,
            method: null,
            signerPayload: null,
            profile: null,
          });
        }
      },
    }),
    {
      name: "pop-auth",
      // Persist only what we need to rebuild the signer; never the transient status or profile.
      partialize: (s) => ({
        pubkey: s.pubkey,
        method: s.method,
        signerPayload: s.signerPayload,
      }),
    },
  ),
);
