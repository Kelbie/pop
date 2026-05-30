import { useEffect, useState } from "react";
import { NDKNip07Signer } from "@nostr-dev-kit/ndk";
import { connectNdk, ndk } from "./lib/ndk";
import { PopCreator } from "./components/PopCreator";

function App() {
  const [status, setStatus] = useState<"connecting" | "connected" | "error">(
    "connecting",
  );

  useEffect(() => {
    connectNdk()
      .then(() => setStatus("connected"))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center gap-8 px-6 py-16">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">Pop</h1>
        <p className="text-neutral-400 max-w-md">
          Decentralized guestbooks for events, on Nostr. Leave notes, drop
          photos, zap the host.
        </p>
        <ConnectionStatus status={status} />
      </div>

      <Host />
    </main>
  );
}

function ConnectionStatus({
  status,
}: {
  status: "connecting" | "connected" | "error";
}) {
  const relayCount = ndk.pool?.relays.size ?? 0;
  return (
    <div className="flex items-center justify-center gap-2 text-sm">
      <span
        className={
          "inline-block h-2.5 w-2.5 rounded-full " +
          (status === "connected"
            ? "bg-green-500"
            : status === "error"
              ? "bg-red-500"
              : "bg-yellow-500 animate-pulse")
        }
      />
      <span className="text-neutral-400">
        {status === "connected"
          ? `Connected to ${relayCount} relay${relayCount === 1 ? "" : "s"}`
          : status === "error"
            ? "Failed to connect to relays"
            : "Connecting to relays…"}
      </span>
    </div>
  );
}

// TEMP: dev-only sign-in so the Pop creator is testable. Replace with the real
// login flow — it just needs to set `ndk.signer` and provide the host pubkey.
function Host() {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    try {
      const signer = new NDKNip07Signer();
      const user = await signer.user();
      ndk.signer = signer;
      ndk.activeUser = user;
      setPubkey(user.pubkey);
    } catch {
      setError("No Nostr extension found (NIP-07).");
    }
  }

  if (!pubkey) {
    return (
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={signIn}
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium transition hover:border-neutral-500"
        >
          Sign in with Nostr
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  return <PopCreator host={pubkey} />;
}

export default App;
