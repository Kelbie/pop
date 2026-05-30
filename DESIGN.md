---
name: Pop
description: A decentralized event guestbook on Nostr — a warm keepsake wall of notes and photos.
colors:
  terracotta: "oklch(57% 0.14 38)"
  terracotta-deep: "oklch(50% 0.145 38)"
  flash-gold: "oklch(82% 0.12 80)"
  paper: "oklch(95.5% 0.008 60)"
  polaroid-white: "oklch(98.5% 0.005 75)"
  ink: "oklch(24% 0.012 50)"
  muted-ink: "oklch(52% 0.014 55)"
  hairline: "oklch(89% 0.008 55)"
  avatar-fill: "oklch(88% 0.008 55)"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "normal"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "normal"
  label:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.02em"
rounded:
  photo: "10px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "9999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "24px"
components:
  card-post:
    backgroundColor: "{colors.polaroid-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
    width: "320px"
  button-primary:
    backgroundColor: "{colors.terracotta}"
    textColor: "{colors.polaroid-white}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.terracotta-deep}"
    textColor: "{colors.polaroid-white}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  input-search:
    backgroundColor: "{colors.polaroid-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  control-button:
    backgroundColor: "{colors.polaroid-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    size: "36px"
---

# Design System: Pop

## 1. Overview

**Creative North Star: "The Disposable Camera"**

Pop is the digital shoebox of party photos and scribbled notes you find months later and can't stop smiling at. The whole system is built around the feeling of a disposable camera at an event: of-the-moment, a little imperfect, flash-lit and warm, and unmistakably *physical*. Notes and photos land on the wall like prints fresh out of the envelope, each one a print someone actually held. The interface is the envelope and the table they're spread across, never the subject. This is a keepsake of one night, not a feed of strangers.

The palette is warm to the core: candlelit paper, polaroid-white prints, ink that's never pure black, and a single terracotta accent that does the work a date-stamp does in the corner of a film print. Depth is soft and earthbound, the way a photo casts a gentle shadow when it rests on a table. Motion is the one place we allow delight to get loud: a new note arrives with a quick flash-and-settle, like the camera just fired. Everywhere else, restraint. The guests' words carry the emotion; our job is to get out of the way and let the wall feel like the night.

This system explicitly rejects four things. It is **not a social feed** — no uniform stacked cards, no like/repost/comment bars, no blue checks, no infinite-scroll energy. It is **not a dark crypto app** — no neon-on-black, no glowing gradients, no cyberpunk grids; the Nostr and Lightning plumbing is invisible and zaps read as *gifts*, not transactions. It is **not a corporate SaaS dashboard** — no flat gray cards, no data tables, no charts. And it is **not AI slop** — no identical card grids, no glassmorphism, no gradient text, no hero-metric template, no side-stripe borders.

**Key Characteristics:**
- Warm paper world, top to bottom — no dark mode, no cool grays.
- One earthy terracotta accent, used sparingly like a date-stamp.
- Soft physical depth: prints resting on a surface, lifting slightly when touched.
- System fonts only (no web-font load) so the canvas measures with final metrics.
- Playfulness lives in motion; stillness everywhere else.

## 2. Colors

A candlelit, paper-warm palette: every neutral is tinted toward the terracotta hue so nothing reads cold, anchored by one earthy clay accent.

### Primary
- **Terracotta Clay** (`oklch(57% 0.14 38)`): The single accent. Carries primary actions (Log in, Create, Sign the guestbook), selection state on the wall, zap and reaction emphasis, focus rings, and links. Earthy red-orange, like a film print's date-stamp. Used on roughly ≤10% of any view — its scarcity is what makes it feel intentional.
- **Terracotta Deep** (`oklch(50% 0.145 38)`): The pressed/hover state of every terracotta surface. Never used at rest.

### Secondary
- **Flash Gold** (`oklch(82% 0.12 80)`): A warm amber reserved almost entirely for *motion* — the camera-flash reveal when a new note lands, a zap burst. Treat it as a moment, not a surface. If it's sitting still on screen, it's probably wrong.

### Neutral
- **Paper** (`oklch(95.5% 0.008 60)`): The wall itself and the app background. Warm off-white, the color of aged matte photo paper. Replaces the old `#f2f1ee` and the retired dark `neutral-950` shell.
- **Polaroid White** (`oklch(98.5% 0.005 75)`): Card and print surfaces, modals, search pill, floating controls. A warm white that's clearly lighter than Paper so cards read as objects resting *on* the wall, never pure `#fff`.
- **Ink** (`oklch(24% 0.012 50)`): Primary text — author names, message bodies. A warm near-black, never `#000`.
- **Muted Ink** (`oklch(52% 0.014 55)`): Meta text — handles, timestamps, the reaction/zap footer. Darkened from the old `#9a9a9a` specifically to clear WCAG AA (~5:1) on Polaroid White; the old value failed.
- **Hairline** (`oklch(89% 0.008 55)`): Borders, dividers, the search-pill edge. A warm 1px line, never a heavy rule.
- **Avatar Fill** (`oklch(88% 0.008 55)`): Placeholder background behind monogram avatars.

### Named Rules
**The Date-Stamp Rule.** Terracotta is a date-stamp, not a coat of paint. It appears on ≤10% of any screen — one accent moment per view, no terracotta panels, no terracotta-tinted cards. If two things on screen are both terracotta competing for the eye, one of them is wrong.

**The No-Cold-Gray Rule.** There are no cool neutrals in Pop. Every gray is tinted warm (hue 50–75, chroma ≥0.005). A neutral that reads blue or slate is a bug.

## 3. Typography

**Display / Body Font:** System UI stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`)
**Label / Stamp Font:** System monospace stack (`ui-monospace, SFMono-Regular, Menlo, monospace`)

**Character:** Deliberately plain and unfussy — the type is the handwriting on the back of the photo, not the photo. System fonts are a hard requirement, not a default: the canvas measures message wrapping with `getMeasureCtx` before paint, so any web-font swap would reflow and clip cards. The one personality move is the monospace **stamp** voice for timestamps and handles — the little orange date in the corner of a disposable-camera print.

### Hierarchy
- **Display** (600, `clamp(2rem, 5vw, 3rem)`, 1.05): The "Pop" wordmark and home hero only.
- **Headline** (600, 1.125rem, 1.3): Modal titles, section headers.
- **Title** (600, 15px, 1.2): Author display name on a card. The loudest thing on a print.
- **Body** (400, 14px, 20px line-height): Message text. Caps at the card content width (288px) on the wall; cap at 65–75ch anywhere it goes full-width. Bumps to 16px in the enlarged detail view.
- **Label** (400, 12px monospace, +0.02em): Handles, relative timestamps, the reaction/zap footer. The date-stamp voice.

### Named Rules
**The Stamp Rule.** Timestamps and `nip05` handles render in the monospace label voice, in Muted Ink. They are the camera's date-stamp — present, legible, never competing with the name or the message.

## 4. Elevation

Soft and physical. Cards are prints resting on the paper wall: a single warm ambient shadow at rest, a slightly deeper one plus a 2px lift when focused or hovered. Depth is *earthbound* — shadows sit close under the object and are tinted warm (never `rgba(0,0,0,...)`), as if lit from above in a warm room. No floating glass, no layered z-stacks, no glow.

### Shadow Vocabulary
- **Print at rest** (`box-shadow: 0 6px 18px oklch(30% 0.02 50 / 0.16)`): Every card on the wall, the search pill, floating controls. The canvas renderer bakes the equivalent into each card texture with a 14px transparent margin so the shadow lives inside the 24px masonry gap.
- **Print lifted** (`box-shadow: 0 12px 28px oklch(30% 0.02 50 / 0.20)`): Hover and keyboard-focus on a card; paired with `transform: translateY(-2px)`. The detail-view print sits here.

### Named Rules
**The Resting-Print Rule.** Surfaces are flat-warm at rest with only their ambient print shadow. Extra elevation is a *response* to interaction (hover, focus, selection), never a decoration applied to draw attention to a static element.

## 5. Components

### Cards / The Print (signature component)
The post card is the heart of the system — a warm-white print on the paper wall.
- **Corner Style:** Gently curved (16px radius, `{rounded.lg}`).
- **Background:** Polaroid White, clearly lighter than the Paper wall behind it.
- **Shadow Strategy:** Print-at-rest by default, Print-lifted on hover/focus (see Elevation).
- **Border:** None at rest. Selected state draws a 2px Terracotta ring (not a side stripe).
- **Internal Padding:** 16px (`{spacing.md}`) on all sides.
- **Anatomy (top to bottom):** 40px avatar + Title name + Stamp handle·time row; Body message; optional photo (cover-fit, 10px `{rounded.photo}`); Muted-Ink footer with reaction/zap counts. Embedded photos read as prints-within-the-print: warm, rounded, never edge-bled.
- **Dual renderer constraint:** Every visual change must be made in BOTH `src/canvas/cardTexture.ts` (the WebGL `<canvas>` texture for the zoomed-out wall) AND `src/components/PostCardContent.tsx` (the crisp DOM version for zoomed-in + detail), with sizing in `src/canvas/cardGeometry.ts`. The two must never disagree or cards clip.

### Buttons
- **Shape:** Gently curved (12px radius, `{rounded.md}`).
- **Primary:** Terracotta Clay background, Polaroid White text, 10px×16px padding. For the loudest action on a screen (Log in, Create a Pop, Sign).
- **Hover / Focus:** Background shifts to Terracotta Deep; visible focus ring in Terracotta. ~150ms ease-out.
- **Ghost:** Paper background, Ink text, Hairline border. For secondary actions ("View the guestbook →", Back).

### Inputs / Search Pill
- **Style:** Polaroid White at 90% over the wall, fully rounded (`{rounded.pill}`), Hairline border, soft print shadow, search-glyph in Muted Ink.
- **Focus:** Border shifts to Terracotta; no heavy glow.

### Floating Controls (zoom / fit / back)
- **Style:** 36px Polaroid White squares, 8px radius (`{rounded.sm}`), print shadow, Ink glyphs. Quiet utility chrome that sits at the edges and never competes with the wall.

### Navigation / Header
- **Style:** Warm and minimal — Paper background with a Hairline bottom border (retiring the dark `neutral-950/80` shell). Wordmark in Display, Ink. Auth control is a Ghost pill with the user's avatar; primary CTA is a Primary button.

### Detail View
- **Style:** A single enlarged Print centered over the dimmed warm wall (backdrop `oklch(24% 0.012 50 / 0.30)` + blur). Same anatomy as the card, Body bumped to 16px. Arrives with the flash-and-settle motion.

## 6. Do's and Don'ts

### Do:
- **Do** keep the whole app on the warm Paper/Polaroid-White world — one coherent keepsake, no dark mode.
- **Do** tint every neutral toward hue 50–75 (chroma ≥0.005). Warm grays only.
- **Do** spend Terracotta like a date-stamp: ≤10% of any view, one accent moment.
- **Do** give cards the Resting-Print shadow at rest and lift them 2px only on hover/focus.
- **Do** render timestamps and handles in the monospace Stamp voice, Muted Ink.
- **Do** mirror every card change across `cardTexture.ts`, `PostCardContent.tsx`, and `cardGeometry.ts`.
- **Do** keep contributions the brightest, loudest thing on screen; let chrome recede.
- **Do** confine playful, flash-gold motion to genuine moments (a note landing, a zap).

### Don't:
- **Don't** reintroduce the **dark crypto app** look — no neon-on-black, no glowing gradients, no cyberpunk grids, no indigo. Zaps are gifts, not transactions.
- **Don't** let the wall become a **generic social feed** — no uniform stacked single-column cards, no like/repost/comment bars, no blue checks, no algorithmic-feed framing.
- **Don't** drift into a **corporate SaaS dashboard** — no flat gray cards, no data tables, no charts, no Bootstrap blandness.
- **Don't** ship **AI slop** — no identical card grids, no decorative glassmorphism, no gradient text, no hero-metric templates.
- **Don't** use a `border-left`/`border-right` colored stripe as an accent on any card; selection is a full 2px Terracotta ring.
- **Don't** use pure `#000` or `#fff`, or any cool/slate gray.
- **Don't** let Muted Ink drift back toward the old `#9a9a9a` — it fails AA on Polaroid White.
- **Don't** introduce a web font on the canvas path; it reflows and clips measured cards.
