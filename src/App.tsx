import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { DonatePage } from "./components/DonatePage";
import { Header } from "./components/Header";
import { LoginModal } from "./components/LoginModal";
import { PopCreator } from "./components/PopCreator";
import { GuestbookCanvasPage } from "./pages/GuestbookCanvasPage";
import { connectNdk, ndk } from "./lib/ndk";
import { useAuthStore } from "./store/auth";

type View = "home" | "canvas";

function Home({ onLoginClick }: { onLoginClick: () => void }) {
  const [status, setStatus] = useState<"connecting" | "connected" | "error">(
    "connecting",
  );
  const [view, setView] = useState<View>("home");

  useEffect(() => {
    connectNdk()
      .then(() => setStatus("connected"))
      .catch(() => setStatus("error"));
  }, []);

  if (view === "canvas") {
    return <GuestbookCanvasPage onClose={() => setView("home")} />;
  }

  return (
    <main className="flex flex-col items-center gap-8 px-6 py-16">
      <div className="flex flex-col items-center text-center space-y-3">
        <img
          src="/logo-dark.jpeg"
          alt="Pop logo"
          className="h-24 w-24 rounded-3xl"
        />
        <h1 className="text-4xl font-bold tracking-tight">Pop</h1>
        <p className="text-neutral-400 max-w-md">
          Decentralized guestbooks for events, on Nostr. Leave notes, drop
          photos, zap the host.
        </p>
        <ConnectionStatus status={status} />
        <button
          type="button"
          onClick={() => setView("canvas")}
          className="mt-1 rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:border-neutral-500 hover:text-white"
        >
          View the guestbook →
        </button>
      </div>

      <CreatorSection onLoginClick={onLoginClick} />
    </main>
  );
}

function App() {
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    // Rebuild a persisted Nostr session, if any.
    void useAuthStore.getState().restore();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <Header onLoginClick={() => setLoginOpen(true)} />

      <Routes>
        <Route
          path="/"
          element={<Home onLoginClick={() => setLoginOpen(true)} />}
        />
        <Route path="/p/:id" element={<DonatePage />} />
      </Routes>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}

function CreatorSection({ onLoginClick }: { onLoginClick: () => void }) {
  const status = useAuthStore((s) => s.status);
  const pubkey = useAuthStore((s) => s.pubkey);

  if (status === "authenticated" && pubkey) {
    return <PopCreator host={pubkey} />;
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-neutral-500">
        Log in to create a Pop for your event.
      </p>
      <button
        type="button"
        onClick={onLoginClick}
        disabled={status === "connecting"}
        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
      >
        {status === "connecting" ? "Connecting…" : "Log in"}
      </button>
    </div>
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

export default App;
