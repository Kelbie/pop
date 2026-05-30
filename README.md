# Pop

A decentralized guestbook for events, built on [Nostr](https://nostr.com). Hosts spin up a guestbook for any event — a wedding, a conference, a birthday, a meetup — and guests leave notes, drop photos, and send the host a little money, all without a centralized server holding the data.

## Why Nostr?

Traditional guestbook apps lock your memories inside someone else's database. Pop stores entries as Nostr events signed by their authors and relayed across the network, so:

- **No central server owns the data.** Entries live on Nostr relays and are cryptographically signed by the guest who wrote them.
- **Guestbooks are portable.** A guestbook is addressable by its Nostr event, so it can be read by any Nostr-aware client, not just this app.
- **Tips are native.** Sending money to the host uses Lightning zaps ([NIP-57](https://github.com/nostr-protocol/nips/blob/master/57.md)) — no payment processor, no account, no chargebacks.

## Features

- **Create a guestbook for an event** — Hosts publish a guestbook with a title, description, and optional cover image.
- **Leave a note** — Guests post text messages to the guestbook.
- **Attach images** — Guests can upload photos to accompany their notes.
- **Send money to the host** — Guests zap the host over the Lightning Network as a tip or gift.
- **Sign in with Nostr** — Authenticate with a browser extension ([NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md)) or generate a throwaway key for one-off guests.

## How it works

1. A **host** signs in and creates a guestbook. This publishes a guestbook event to a set of Nostr relays.
2. The guestbook gets a shareable link (and/or QR code) the host can display at their event.
3. A **guest** opens the link, signs in (or uses a generated key), and leaves a note, photo, or both.
4. Each entry is signed by the guest and published to the same relays, tagged to the guestbook.
5. Guests can **zap the host** — a Lightning payment routed to the host's Nostr-linked Lightning address.

## Tech stack

- **[React](https://react.dev)** + **[TypeScript](https://www.typescriptlang.org)** — UI
- **[Vite](https://vite.dev)** — build tooling / dev server
- **[Tailwind CSS](https://tailwindcss.com)** (v4) — styling
- **[Nostr Dev Kit (NDK)](https://github.com/nostr-dev-kit/ndk)** — Nostr client, relay management, signing, and zaps
- **[Bun](https://bun.sh)** — package manager and runtime
- **NIP-07** — browser-extension key signing (via NDK's `NDKNip07Signer`)
- **NIP-57** — Lightning zaps for sending money to the host (via NDK's zap helpers)
- **NIP-94 / Blossom** — image attachments (hosted media referenced from entries)

## Getting started

> _Work in progress — only the shell is scaffolded so far. It connects to relays via NDK and shows connection status._

### Prerequisites

- [Bun](https://bun.sh) (v1.3+)
- A Nostr signing extension such as [Alby](https://getalby.com) or [nos2x](https://github.com/fiatjaf/nos2x) for hosts
- A Lightning address on the host's Nostr profile to receive zaps

### Install

```bash
git clone <repo-url> pop
cd pop
bun install
```

### Run

```bash
bun dev
```

Other scripts:

```bash
bun run build    # production build
bun run preview  # preview the production build
bun run lint     # lint
```

## Configuration

Relays are configured via a Vite environment variable. Create a `.env` (or `.env.local`):

```bash
# defaults to wss://relay.damus.io,wss://nos.lol if unset
VITE_RELAYS=wss://relay.damus.io,wss://nos.lol
```

The shared NDK instance lives in [`src/lib/ndk.ts`](src/lib/ndk.ts) — relays, signing, and zaps all flow through it.

## Roadmap

- [x] Project shell (React + Vite + Tailwind + NDK, relay connection)
- [ ] Host guestbook creation flow
- [ ] Guest note + image posting
- [ ] Lightning zap integration
- [ ] Shareable links and QR codes
- [ ] Moderation tools for hosts
- [ ] Export / archive a guestbook

## License

TBD
