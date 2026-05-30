# AGENTS.md

Guidance for AI agents (and humans) working in this repo. Keep this file current when you
change architecture, conventions, or tooling.

## Project

Pop — a decentralized guestbook for events, built on Nostr. See `README.md` for product
context. Entries are signed Nostr events relayed across the network; there is no central backend.

## Stack & tooling

- **React 19 + TypeScript**, built with **Vite 8**.
- **Tailwind CSS v4** (via `@tailwindcss/vite`), imported in `src/index.css` as `@import "tailwindcss";`.
  Styling is Tailwind utility classes only — no CSS-in-JS, no component library. The theme is dark:
  `bg-neutral-950` / `text-neutral-100`, with `indigo-600` as the primary accent.
- **[NDK](https://github.com/nostr-dev-kit/ndk)** (`@nostr-dev-kit/ndk`) for all Nostr work — relays,
  signing, profiles, and (planned) zaps. Do not hand-roll protocol code; prefer NDK's helpers/signers.
- **[Zustand](https://github.com/pmndrs/zustand) v5** (`persist` middleware) for client state.
- **[qrcode.react](https://github.com/zpao/qrcode.react)** for rendering connection QR codes.
- **Bun** is the package manager and runtime.

### Commands

```bash
bun install
bun run dev      # vite dev server
bun run build    # tsc -b && vite build  — must pass clean
bun run lint     # eslint . — must pass clean
```

Always run `bun run build` and `bun run lint` before committing; both must exit 0. (Note: the build
prints `eval` warnings originating from NDK's transitive `tseep` dependency — these are warnings, not
errors, and do not fail the build.)

## Layout

```
src/
  main.tsx              entry point
  App.tsx               root: mounts <Header>, <LoginModal>, restores session, shows relay status
  index.css             Tailwind import
  lib/
    ndk.ts              the shared `ndk` NDK singleton + connectNdk() (relays from VITE_RELAYS env)
  store/
    auth.ts             Zustand auth store — single source of truth for identity
  components/
    Modal.tsx           generic portal modal (backdrop, Escape, click-outside, body-scroll-lock)
    LoginModal.tsx      tabbed login UI built on <Modal>
    Header.tsx          sticky top nav: login button / user chip + logout
```

## Authentication architecture

Login supports the three standard Nostr methods, all via NDK signers. The flow lives in
`src/store/auth.ts`.

- **Browser extension (NIP-07)** — `new NDKNip07Signer()`. Recommended; default tab when
  `window.nostr` is present.
- **Remote signer / bunker (NIP-46)** — `NDKNip46Signer.bunker(ndk, "bunker://…")` for pasted bunker
  URLs, and `NDKNip46Signer.nostrconnect(ndk, relay, undefined, opts)` for the client-initiated
  `nostrconnect://` QR flow. Read `signer.nostrConnectUri` to render the QR; await
  `signer.blockUntilReady()` to detect connection.
- **Private key (nsec)** — `new NDKPrivateKeySigner(nsec)`. Pass the `nsec1…` string **directly** —
  do NOT `nip19.decode()` it first. Discouraged in the UI behind a security warning.

### Conventions / invariants

- **`ndk` is a singleton** (`src/lib/ndk.ts`). Always import it; never construct a second NDK. Login
  sets `ndk.signer`; logout sets it to `undefined`.
- **Session persistence uses NDK's payload mechanism, not bespoke per-method storage.** Each signer's
  `signer.toPayload()` string is persisted; `ndkSignerFromPayload(payload, ndk)` rebuilds the correct
  signer type on reload. `restore()` is called once from `App` on mount. When adding a new login
  method, just store its `toPayload()` — do not invent new persistence.
- **The Zustand store persists only `{ pubkey, method, signerPayload }`** (see `partialize`). Never
  persist the live signer instance, `status`, or `profile`.
- **Security note:** nsec login persists the private key in plaintext in `localStorage`
  (`pop-auth`), because `NDKPrivateKeySigner.toPayload()` embeds the hex key. This is an
  intentional, documented tradeoff. If hardening later, NDK ships `nip49` for ncryptsec encryption.
- All UI is dark-themed Tailwind; match the existing `neutral`/`indigo` palette and the rounded,
  bordered panel style used in `Modal.tsx` / `Header.tsx`.

## Style

- Match the surrounding code: TypeScript, functional React components, named exports for components.
- Keep comments sparse and purposeful (explain *why*, mirror the existing density).
- New dependencies should be justified and minimal — the project deliberately keeps a small footprint.
