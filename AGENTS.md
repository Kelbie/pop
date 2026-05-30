# AGENTS.md

Guidance for AI agents (and humans) working in this repo. Read this before making changes,
and keep it current when you change architecture, conventions, or tooling.

## Project

Pop — a decentralized guestbook for events, built on [Nostr](https://nostr.com). A host spins up a
guestbook for an event (wedding, conference, birthday, meetup); guests leave notes, drop photos, and
zap the host a little money. See `README.md` for product context. Entries are signed Nostr events
relayed across the network; there is no central backend holding the data.

Core ideas:

- **No central server owns the data.** Entries live on Nostr relays, signed by the guest who wrote them.
- **Guestbooks are portable.** A guestbook is an addressable Nostr event, readable by any Nostr-aware client.
- **Tips are native.** Sending money to the host is a Lightning zap ([NIP-57](https://github.com/nostr-protocol/nips/blob/master/57.md)) — no processor, no account, no chargebacks.

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
  App.tsx               root: mounts <Header>, <LoginModal>, restores session, gates the Pop creator on auth
  index.css             Tailwind import
  lib/
    ndk.ts              the shared `ndk` NDK singleton + connectNdk() (relays from VITE_RELAYS env)
    pop.ts              Pop (guestbook) data model — POP_KIND, createPop(), fetchPops()
  store/
    auth.ts             Zustand auth store — single source of truth for identity
  components/
    Modal.tsx           generic portal modal (backdrop, Escape, click-outside, body-scroll-lock)
    LoginModal.tsx      tabbed login UI built on <Modal>
    Header.tsx          sticky top nav: login button / user chip + logout
    PopCreator.tsx      host UI: create-a-Pop form + list of the host's Pops
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
- **Read the logged-in host from the store**, not `ndk.activeUser`: `useAuthStore((s) => s.pubkey)`
  with `status === "authenticated"`. `App` gates the Pop creator on this.
- **Security note:** nsec login persists the private key in plaintext in `localStorage`
  (`pop-auth`), because `NDKPrivateKeySigner.toPayload()` embeds the hex key. This is an
  intentional, documented tradeoff. If hardening later, NDK ships `nip49` for ncryptsec encryption.

## Pop data model (guestbooks)

A Pop is an **addressable / parameterized-replaceable event** (NIP-01 kind range 30000–39999) so a
host can edit it in place and reference it by an `naddr` ([NIP-19](https://github.com/nostr-protocol/nips/blob/master/19.md)).
The model lives in `src/lib/pop.ts`.

- **`POP_KIND = 31337`** — Pop's own kind for guestbook events. (No NIP reserves a guestbook kind;
  this is a bespoke addressable kind. Document any change here.)
- **Tags:** `["d", <uuid>]` unique identifier · `["title", <event name>]` (NIP-23 convention) ·
  `["alt", …]` ([NIP-31](https://github.com/nostr-protocol/nips/blob/master/31.md)) human-readable fallback.
- **Content:** the guestbook description (plain text).
- `createPop({ name, description })` publishes via `event.publish()` (NDK signs with `ndk.signer`).
- `fetchPops(host)` queries `{ kinds: [POP_KIND], authors: [host] }` and dedupes by `d` tag (newest wins).
- Share a Pop with `event.encode()` → `naddr`.

Guestbook *entries* (notes/photos/zaps) are not built yet; see the NIP mapping below for the planned scheme.

---

## Nostr primer (how the infra works)

Nostr = **Notes and Other Stuff Transmitted by Relays**. The whole protocol is
small; capability comes from layering conventions (NIPs) on top of two pieces:

- **Events** — every piece of data is a JSON object: `{ id, pubkey, created_at, kind, tags, content, sig }`.
  `id` is the sha256 of the serialized event; `sig` is a Schnorr signature over `id`
  by the author's secp256k1 key. The `kind` (an integer) decides what the event *means*.
- **Relays** — dumb WebSocket servers that store events and serve them by filter.
  Clients publish to many relays and subscribe across many relays. Relays don't
  trust each other or talk to each other; redundancy comes from clients fanning out.

Identity is a keypair. `npub.../nsec...` are bech32 encodings ([NIP-19](https://github.com/nostr-protocol/nips/blob/master/19.md))
of the public/secret key. There are no accounts — your key *is* your identity, on
every relay and every client.

**Event-kind ranges** (rough rules from [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md)):

- `1000–9999`: regular (relays store all of them)
- `10000–19999`: **replaceable** (relay keeps only the newest per `pubkey`+`kind`) — e.g. profile, relay list
- `20000–29999`: **ephemeral** (relays don't store; used for transient signaling)
- `30000–39999`: **addressable / parameterized-replaceable** (newest per `pubkey`+`kind`+`d`-tag) — the basis for "documents" like long-form posts, lists, and **Pop's guestbook** (kind `31337`, above)

## NIPs that power what Nostr can do

NIP = *Nostr Implementation Possibility*. Full index:
<https://github.com/nostr-protocol/nips>. They're an à-la-carte menu — implement
only what a use case needs. Distilled by capability:

### Foundation (almost everything builds on these)

| NIP | Capability |
| --- | --- |
| [01](https://github.com/nostr-protocol/nips/blob/master/01.md) | Core protocol: event format, signatures, relay REQ/EVENT/EOSE messages, filters, kind ranges |
| [11](https://github.com/nostr-protocol/nips/blob/master/11.md) | Relay Information Document — a relay advertises its limits, supported NIPs, fees |
| [19](https://github.com/nostr-protocol/nips/blob/master/19.md) | `npub`/`nsec`/`note`/`naddr`/`nevent` bech32 entities — shareable, self-describing references |
| [21](https://github.com/nostr-protocol/nips/blob/master/21.md) | `nostr:` URI scheme for deep-linking entities |
| [65](https://github.com/nostr-protocol/nips/blob/master/65.md) | Relay List Metadata — where a user reads/writes, so clients know which relays to hit ("outbox model") |

### Identity, profiles, social graph

| NIP | Capability |
| --- | --- |
| [02](https://github.com/nostr-protocol/nips/blob/master/02.md) | Follow list |
| [05](https://github.com/nostr-protocol/nips/blob/master/05.md) | Human-readable `name@domain` verification mapped to a pubkey via DNS/HTTPS |
| [39](https://github.com/nostr-protocol/nips/blob/master/39.md) | Link external identities (GitHub, Twitter) to a profile |
| [51](https://github.com/nostr-protocol/nips/blob/master/51.md) | Lists / sets (mute, pin, bookmarks, custom curated sets) |

### Signing & key management (Pop's login)

| NIP | Capability |
| --- | --- |
| [07](https://github.com/nostr-protocol/nips/blob/master/07.md) | `window.nostr` browser-extension signer (Alby, nos2x). **Pop's recommended host login.** Key never touches the app |
| [46](https://github.com/nostr-protocol/nips/blob/master/46.md) | Remote signing ("Nostr Connect" / bunker) — sign from a separate device/app. **Implemented** (paste-bunker + QR) |
| [49](https://github.com/nostr-protocol/nips/blob/master/49.md) | Encrypt an `nsec` with a passphrase for at-rest storage |
| [42](https://github.com/nostr-protocol/nips/blob/master/42.md) | Client→relay authentication (for relays that gate read/write) |

### Content kinds (what guestbook entries could be)

| NIP | Capability |
| --- | --- |
| [10](https://github.com/nostr-protocol/nips/blob/master/10.md) | Text notes & threads (`e`/`p` tag reply conventions) |
| [22](https://github.com/nostr-protocol/nips/blob/master/22.md) | Generic threaded **comments** (kind `1111`) on any addressable object — a strong fit for guestbook entries |
| [23](https://github.com/nostr-protocol/nips/blob/master/23.md) | Long-form addressable content |
| [25](https://github.com/nostr-protocol/nips/blob/master/25.md) | Reactions (likes/emoji) |
| [18](https://github.com/nostr-protocol/nips/blob/master/18.md) | Reposts |
| [27](https://github.com/nostr-protocol/nips/blob/master/27.md) | Inline `nostr:` mentions/references in note content |

### Media / images (relevant to "drop photos")

| NIP | Capability |
| --- | --- |
| [B7](https://github.com/nostr-protocol/nips/blob/master/B7.md) | **Blossom** — content-addressed blob storage on media servers. Current recommended way to host images |
| [94](https://github.com/nostr-protocol/nips/blob/master/94.md) | File Metadata events (hash, mime, dimensions) describing a hosted file |
| [92](https://github.com/nostr-protocol/nips/blob/master/92.md) | `imeta` tags — attach media metadata inline on a note |
| [98](https://github.com/nostr-protocol/nips/blob/master/98.md) | HTTP Auth — sign an HTTP request with your Nostr key (used by media servers) |

> Note: [NIP-96](https://github.com/nostr-protocol/nips/blob/master/96.md) (HTTP file storage) is deprecated in favor of Blossom.

### Money / Lightning (relevant to "zap the host")

| NIP | Capability |
| --- | --- |
| [57](https://github.com/nostr-protocol/nips/blob/master/57.md) | **Lightning Zaps** — public, verifiable Lightning tips attached to a note/profile. **Pop's tipping mechanism.** Needs a Lightning address on the host's profile (kind `0` `lud16`) |
| [75](https://github.com/nostr-protocol/nips/blob/master/75.md) | Zap Goals — fundraising targets |
| [47](https://github.com/nostr-protocol/nips/blob/master/47.md) | Nostr Wallet Connect — remote-control a Lightning wallet to *send* zaps |
| [60](https://github.com/nostr-protocol/nips/blob/master/60.md) / [61](https://github.com/nostr-protocol/nips/blob/master/61.md) | Cashu ecash wallet + "nutzaps" (token-based tips) |

### Privacy & encryption

| NIP | Capability |
| --- | --- |
| [44](https://github.com/nostr-protocol/nips/blob/master/44.md) | Versioned encrypted payloads (modern crypto; replaces NIP-04) |
| [59](https://github.com/nostr-protocol/nips/blob/master/59.md) | Gift Wrap — hide metadata (sender, kind) by nesting sealed events |
| [17](https://github.com/nostr-protocol/nips/blob/master/17.md) | Private DMs (built on 44 + 59) |

### Moderation / housekeeping (relevant to host moderation tools + export)

| NIP | Capability |
| --- | --- |
| [09](https://github.com/nostr-protocol/nips/blob/master/09.md) | Event deletion *requests* (advisory — relays may honor) |
| [56](https://github.com/nostr-protocol/nips/blob/master/56.md) | Reporting events/users |
| [36](https://github.com/nostr-protocol/nips/blob/master/36.md) | Content warnings / sensitive-content tagging |
| [40](https://github.com/nostr-protocol/nips/blob/master/40.md) | Expiration timestamps — events that self-expire |
| [70](https://github.com/nostr-protocol/nips/blob/master/70.md) | Protected events — only the author may publish them |
| [50](https://github.com/nostr-protocol/nips/blob/master/50.md) | Search capability (relay-side full-text) |

### Discovery / app glue

| NIP | Capability |
| --- | --- |
| [89](https://github.com/nostr-protocol/nips/blob/master/89.md) | Recommended application handlers — "open this kind in app X" |
| [78](https://github.com/nostr-protocol/nips/blob/master/78.md) | App-specific data (kind `30078`) — store private app config/state as an addressable event |

## How the NIPs map onto Pop

| Pop feature | Likely NIP(s) |
| --- | --- |
| Sign in (host) | [07](https://github.com/nostr-protocol/nips/blob/master/07.md), [46](https://github.com/nostr-protocol/nips/blob/master/46.md) bunker/nostrconnect, nsec — **implemented** in `store/auth.ts` |
| Create a guestbook | addressable event kind `31337` with a `d` tag; reference via [19](https://github.com/nostr-protocol/nips/blob/master/19.md) `naddr` — **implemented** in `lib/pop.ts` |
| Leave a note | [22](https://github.com/nostr-protocol/nips/blob/master/22.md) comment tagged to the guestbook `naddr`, or a plain note |
| Attach a photo | [B7](https://github.com/nostr-protocol/nips/blob/master/B7.md) Blossom upload + [92](https://github.com/nostr-protocol/nips/blob/master/92.md)/[94](https://github.com/nostr-protocol/nips/blob/master/94.md) metadata |
| Zap the host | [57](https://github.com/nostr-protocol/nips/blob/master/57.md) (host needs `lud16` on kind `0`) |
| Shareable link / QR | [19](https://github.com/nostr-protocol/nips/blob/master/19.md) `naddr` + [21](https://github.com/nostr-protocol/nips/blob/master/21.md) `nostr:` URI |
| Knowing which relays to hit | [65](https://github.com/nostr-protocol/nips/blob/master/65.md) relay lists |
| Host moderation | [09](https://github.com/nostr-protocol/nips/blob/master/09.md) deletion requests, [56](https://github.com/nostr-protocol/nips/blob/master/56.md) reporting |

> Entry/zap rows are design directions, not yet implemented. Confirm the kind/tag scheme
> before building a flow — pick the smallest set of NIPs that satisfies it.

## Style & working agreements

- Keep all Nostr access flowing through the single NDK instance in `src/lib/ndk.ts`.
- Don't hardcode relay URLs in components; use the env-driven list (`VITE_RELAYS`).
- Prefer existing NDK helpers (signers, zapper, fetchEvents/subscribe) over hand-rolling relay messages.
- When introducing a new event kind or tag scheme, document the choice and cite the NIP (see the Pop data model above).
- All UI is dark-themed Tailwind; match the existing `neutral`/`indigo` palette and the rounded,
  bordered panel style used in `Modal.tsx` / `Header.tsx`.
- Match the surrounding code: TypeScript, functional React components, named exports for components.
- Keep comments sparse and purposeful (explain *why*, mirror the existing density).
- New dependencies should be justified and minimal — the project deliberately keeps a small footprint.
- Run `bun run build` and `bun run lint` before finishing; both must pass clean.
