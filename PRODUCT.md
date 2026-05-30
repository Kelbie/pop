# Product

## Register

product

## Users

Two roles share the app, but the guestbook canvas is built for **guests**:

- **Hosts** — someone throwing an event (wedding, conference, birthday, meetup) who spins up a guestbook, displays a link or QR at the venue, and collects notes, photos, and Lightning zaps. Comfortable enough with Nostr to sign in with an extension.
- **Guests** — attendees at the event, often on a phone, often non-technical, frequently using a generated throwaway key for a one-off signing. Their context is the moment: a few drinks in, phone out, wanting to leave a quick note or photo and maybe tip the host. They will not learn Nostr to do it, and they may never open the app again.

The job to be done: **leave a lasting mark on a real-world moment, and revisit the wall of everyone else's marks.** Reading the wall is as important as writing to it; it's a shared keepsake, not a personal feed.

## Product Purpose

Pop is a decentralized guestbook for events, built on Nostr. Entries are signed Nostr events relayed across the network, so the memories aren't trapped in one company's database, the guestbook is portable to any Nostr client, and tips to the host are native Lightning zaps (NIP-57) with no payment processor.

The guestbook canvas is the heart of the product: an infinite, zoomable masonry wall of post cards (note + optional photo + author + reactions/zaps), rendered on a Pixi.js stage with DOM overlays for crisp text when zoomed in. Success is when a guest opens the link, instantly understands they're looking at a collective memory of the event, and feels moved to add to it — and when, months later, the host and guests revisit the wall and it still feels like the night.

## Brand Personality

Three words: **warm, celebratory, crafted.**

The wall should feel like a physical keepsake — a pinboard of polaroids and handwritten notes from a real event — rendered with calm, gallery-like restraint so the guests' words and photos are the art and the UI chrome recedes. Underneath the warmth there's room for playful, delightful micro-interactions: leaving a note and watching it land on the wall should feel a little magical. The voice is human and unpretentious, never corporate, never crypto-bro. It celebrates the moment without shouting.

Emotional goals: a guest feels *invited* and *moved to contribute*; a host feels their event was *honored*; a returning visitor feels *nostalgia*.

## Anti-references

The post and the wall must NOT look like any of these:

- **A generic social feed.** No Twitter/X or Instagram clone — no uniform stacked single-column cards, no like/repost/comment action bars, no blue verification checks, no algorithmic-feed energy. This is a bounded keepsake of one event, not an infinite scroll of strangers.
- **Neon web3 / dark crypto.** No neon-on-black, no glowing gradients, no cyberpunk grids, no "crypto app" stereotype. The Nostr/Lightning plumbing is invisible to the guest; zaps read as *gifts*, not transactions.
- **Corporate SaaS dashboard.** No sterile enterprise UI, no dense data tables, no flat gray cards, no charts, no Bootstrap blandness.
- **AI-generated slop.** No identical card grids, no decorative glassmorphism, no gradient text, no hero-metric templates, no side-stripe borders. If it reads as "AI made that," it failed.

## Design Principles

1. **The guests are the content; the UI is the frame.** Notes and photos carry the emotion. Chrome (nav, controls, the card shell itself) stays quiet and recedes so the human contributions are what you see.
2. **Keepsake, not feed.** Every choice should reinforce that this is a finite, treasured collection of one moment — physical, warm, revisitable — not a stream to scroll and forget. Favor pinboard/gallery metaphors over timeline metaphors.
3. **Warmth with restraint.** Celebratory and human, but composed and elegant. Playfulness lives in motion and micro-interaction, not in loud color or clutter. When in doubt, quieter.
4. **Invisible protocol.** Nostr keys, relays, and Lightning are implementation, not interface. A non-technical guest never has to understand them to leave a note or send a gift.
5. **Mobile-first, in-the-moment.** Most signing happens on a phone at the venue, one-handed, distracted, possibly on bad wifi. The path to leave a note or photo must be effortless and forgiving.

## Accessibility & Inclusion

Target **WCAG 2.1 AA.** Body and meta text meet AA contrast against the warm paper background (watch the muted meta-gray on white — currently borderline). Fully keyboard navigable, including the canvas: focusing/opening a post and dismissing the detail view must work without a pointer. Honor `prefers-reduced-motion` (already wired for card/modal animations — extend to any new motion). All interactive controls and images get accessible labels; avatars and decorative media use empty/appropriate alt text. Don't rely on color alone to convey state (search dimming, selection). Audience can skew all-ages, so keep touch targets generous and copy plain.
