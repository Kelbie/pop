import type { CSSProperties } from "react";
import {
  CARD_COLORS,
  CARD_SHADOW_LIFT,
  CARD_SHADOW_REST,
} from "../canvas/cardTheme";

/**
 * The header of a Pop, rendered as a warm print resting on the wall: a wide
 * banner with the event's picture/logo overlapping its bottom edge, then the
 * title and description. Read-only and presentational — used both as the
 * landing-page example and as a live preview while creating a Pop, so the two
 * can never drift.
 */
export function PopHeaderCard({
  name,
  description,
  picture,
  banner,
}: {
  name: string;
  description?: string;
  picture?: string | null;
  banner?: string | null;
}) {
  const printVars = {
    "--print-surface": CARD_COLORS.surface,
    "--print-shadow-rest": CARD_SHADOW_REST,
    "--print-shadow-lift": CARD_SHADOW_LIFT,
    "--print-ring": CARD_COLORS.ink,
  } as CSSProperties;

  const initial = name.trim()[0]?.toUpperCase() ?? "P";

  return (
    <div
      className="pop-print w-full max-w-md overflow-hidden rounded-2xl"
      style={printVars}
    >
      {/* Banner */}
      <div
        className="aspect-[3/1] w-full"
        style={{
          backgroundColor: CARD_COLORS.mediaPlaceholder,
          backgroundImage: banner ? `url(${banner})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Picture / logo, overlapping the banner's bottom edge */}
      <div className="relative px-5 pb-5">
        <div
          className="absolute -top-9 left-5 flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full text-2xl font-semibold ring-4 ring-polaroid"
          style={{
            backgroundColor: CARD_COLORS.avatarFill,
            color: CARD_COLORS.avatarInk,
          }}
        >
          {picture ? (
            <img
              src={picture}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            initial
          )}
        </div>

        <div className="pt-12">
          <h3
            className="text-lg font-semibold leading-tight"
            style={{ color: CARD_COLORS.ink }}
          >
            {name || "Your event"}
          </h3>
          {description && (
            <p
              className="mt-1.5 whitespace-pre-wrap break-words text-sm"
              style={{ color: CARD_COLORS.mutedInk }}
            >
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
