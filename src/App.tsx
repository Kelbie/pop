import { useEffect, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AmbientBackground } from "./components/AmbientBackground";
import { Header } from "./components/Header";
import { LoginModal } from "./components/LoginModal";
import { PopCreator } from "./components/PopCreator";
import { PopHeaderCard } from "./components/PopHeaderCard";
import { EventGuestbookPage } from "./pages/EventGuestbookPage";
import { connectNdk } from "./lib/ndk";
import { SAMPLE_POP } from "./lib/sampleData";
import { useAuthStore } from "./store/auth";

function Home({ onCreateClick }: { onCreateClick: () => void }) {
  useEffect(() => {
    void connectNdk().catch(() => {});
  }, []);

  return (
    <div className="relative">
      {/* Warm candlelit atmosphere behind the whole landing. */}
      <AmbientBackground />

      <main className="relative z-10 mx-auto max-w-3xl px-6 pb-24">
        {/* Hero */}
        <section className="flex flex-col items-center gap-6 pt-16 text-center">
          <img
            src="/pop.png"
            alt="Pop logo"
            className="h-40 w-40 rounded-3xl shadow-[0_10px_30px_rgba(36,30,26,0.18)]"
          />
          <p className="mx-auto max-w-md text-lg text-muted">
            A guestbook for your event that lives forever. Spin one up, share the
            link, and let everyone leave notes, photos, and tips — no app, no
            account required.
          </p>
          <button
            type="button"
            onClick={onCreateClick}
            className="rounded-xl bg-ink px-6 py-3 text-base font-semibold text-polaroid shadow-sm transition hover:bg-avatar-ink active:translate-y-px"
          >
            Create an event
          </button>
        </section>

        {/* Example */}
        <section className="mt-20 flex flex-col items-center gap-6 text-center">
          <div className="space-y-1.5">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">
              Here's what your guestbook looks like
            </h2>
            <p className="text-sm text-muted">
              Your event gets its own warm, shareable page.
            </p>
          </div>
          <PopHeaderCard
            name={SAMPLE_POP.name}
            description={SAMPLE_POP.description}
            picture={SAMPLE_POP.picture}
            banner={SAMPLE_POP.banner}
          />
        </section>

        {/* How it works */}
        <section className="mt-20">
          <div className="grid gap-8 sm:grid-cols-3">
            <Step
              n="1"
              title="Create a guestbook"
              body="Name your event, add a cover photo and banner, and you're live in seconds."
            />
            <Step
              n="2"
              title="Share the link"
              body="Drop the link in the invite, on a card, or behind a QR code at the door."
            />
            <Step
              n="3"
              title="Collect the memories"
              body="Guests leave notes and photos — and can zap you a tip — that you keep forever."
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-semibold text-polaroid">
        {n}
      </span>
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="text-sm text-muted">{body}</p>
    </div>
  );
}

function CreatePage({ onLoginClick }: { onLoginClick: () => void }) {
  const status = useAuthStore((s) => s.status);
  const pubkey = useAuthStore((s) => s.pubkey);

  if (status === "authenticated" && pubkey) {
    return (
      <main className="mx-auto flex max-w-xl flex-col items-center px-6 py-12">
        <PopCreator host={pubkey} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-2xl font-bold text-ink">Log in to create a Pop</h1>
      <p className="mt-2 text-muted">
        You'll need a Nostr account to host a guestbook. It takes one click.
      </p>
      <button
        type="button"
        onClick={onLoginClick}
        disabled={status === "connecting"}
        className="mt-6 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-polaroid transition hover:bg-avatar-ink active:translate-y-px disabled:opacity-50 disabled:active:translate-y-0"
      >
        {status === "connecting" ? "Connecting…" : "Log in"}
      </button>
    </main>
  );
}

function App() {
  const [loginOpen, setLoginOpen] = useState(false);
  // Set when the user clicks "Create an event" while logged out: once they
  // finish logging in, we continue on to the creator instead of stranding them
  // on the landing page.
  const [pendingCreate, setPendingCreate] = useState(false);
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const pubkey = useAuthStore((s) => s.pubkey);

  // The guestbook page is a full-screen canvas with its own floating top bar,
  // so the global header is hidden there.
  const fullBleed = useLocation().pathname.startsWith("/e/");

  useEffect(() => {
    // Rebuild a persisted Nostr session, if any.
    void useAuthStore.getState().restore();
  }, []);

  useEffect(() => {
    if (pendingCreate && status === "authenticated" && pubkey) {
      setPendingCreate(false);
      navigate("/create");
    }
  }, [pendingCreate, status, pubkey, navigate]);

  function handleCreateClick() {
    if (status === "authenticated" && pubkey) {
      navigate("/create");
    } else {
      setPendingCreate(true);
      setLoginOpen(true);
    }
  }

  function closeLogin() {
    setLoginOpen(false);
    setPendingCreate(false);
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      {!fullBleed && <Header onLoginClick={() => setLoginOpen(true)} />}

      <Routes>
        <Route path="/" element={<Home onCreateClick={handleCreateClick} />} />
        <Route
          path="/create"
          element={<CreatePage onLoginClick={() => setLoginOpen(true)} />}
        />
        <Route
          path="/e/:nevent"
          element={
            <EventGuestbookPage onLoginClick={() => setLoginOpen(true)} />
          }
        />
      </Routes>

      <LoginModal open={loginOpen} onClose={closeLogin} />
    </div>
  );
}

export default App;
