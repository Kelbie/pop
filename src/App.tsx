import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { LoginModal } from "./components/LoginModal";
import { connectNdk, ndk } from "./lib/ndk";
import { useAuthStore } from "./store/auth";

function App() {
  const [status, setStatus] = useState<"connecting" | "connected" | "error">(
    "connecting",
  );
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    connectNdk()
      .then(() => setStatus("connected"))
      .catch(() => setStatus("error"));
    // Rebuild a persisted Nostr session, if any.
    void useAuthStore.getState().restore();
  }, []);

  const relayCount = ndk.pool?.relays.size ?? 0;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <Header onLoginClick={() => setLoginOpen(true)} />

      <main className="flex flex-col items-center justify-center gap-6 px-6 py-24">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">Pop</h1>
          <p className="text-neutral-400 max-w-md">
            Decentralized guestbooks for events, on Nostr. Leave notes, drop
            photos, zap the host.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm">
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
      </main>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}

export default App;
