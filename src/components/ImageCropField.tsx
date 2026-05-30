import { useRef, useState, type CSSProperties } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Modal } from "./Modal";
import { uploadImageBlob } from "../lib/blossom";

/**
 * A single image field for the Pop creator: pick a file, frame it with an
 * interactive cropper locked to `aspect`, then upload the cropped blob to a
 * Blossom server. `value` is the uploaded URL (or null); `onChange` fires with
 * the new URL once upload completes (and with null on remove).
 *
 * `onUploadingChange` lets the parent gate its submit button while an upload is
 * in flight, so a Pop is never published with a half-uploaded image.
 *
 * Layout knobs let the creator compose a profile-header shape:
 *  - `circle` renders the preview/placeholder as a round avatar.
 *  - `fill` makes it fill a parent-sized box (h/w 100%) instead of using `aspect`.
 *  - `hideLabel` drops the heading (the parent labels it).
 *  - `overlayControls` floats a remove button over the image and makes the
 *    image itself click-to-replace, so there's no controls row breaking the
 *    composition.
 */
export function ImageCropField({
  label,
  aspect,
  value,
  onChange,
  onUploadingChange,
  circle = false,
  fill = false,
  hideLabel = false,
  overlayControls = false,
  className,
}: {
  label: string;
  aspect: number;
  value: string | null;
  onChange: (url: string | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
  circle?: boolean;
  fill?: boolean;
  hideLabel?: boolean;
  overlayControls?: boolean;
  className?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Object URL of the just-picked file, shown in the crop modal.
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;
    setError(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setSrc(URL.createObjectURL(file));
  }

  function closeModal() {
    if (src) URL.revokeObjectURL(src);
    setSrc(null);
    setAreaPixels(null);
  }

  async function confirmCrop() {
    if (!src || !areaPixels) return;
    setUploading(true);
    onUploadingChange?.(true);
    setProgress(0);
    setError(null);
    try {
      const blob = await getCroppedBlob(src, areaPixels);
      const url = await uploadImageBlob(blob, setProgress);
      onChange(url);
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  }

  const shape = circle ? "rounded-full" : "rounded-lg";
  const boxStyle: CSSProperties = fill ? {} : { aspectRatio: aspect };
  const boxSize = fill ? "h-full w-full" : "w-full";
  const pick = () => fileInputRef.current?.click();

  // In `fill` mode the box sizes to its parent, so the root must fill it too —
  // otherwise an intermediate auto-height div collapses and squashes the box.
  const rootCls =
    className ??
    [fill ? "h-full w-full" : "", overlayControls ? "" : "space-y-1.5"]
      .join(" ")
      .trim();

  return (
    <div className={rootCls || undefined}>
      {!hideLabel && <span className="text-sm text-muted">{label}</span>}

      {value ? (
        overlayControls ? (
          <div className={"relative " + boxSize} style={boxStyle}>
            <button
              type="button"
              onClick={pick}
              aria-label={`Replace ${label.toLowerCase()}`}
              className={
                "group block h-full w-full overflow-hidden " + shape
              }
            >
              <img
                src={value}
                alt={`${label} preview`}
                className="h-full w-full object-cover transition group-hover:brightness-90"
              />
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label={`Remove ${label.toLowerCase()}`}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-sm text-polaroid transition hover:bg-ink"
            >
              ×
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <img
              src={value}
              alt={`${label} preview`}
              style={{ aspectRatio: aspect }}
              className={"w-full border border-hairline object-cover " + shape}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={pick}
                className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-paper"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-terracotta transition hover:bg-paper"
              >
                Remove
              </button>
            </div>
          </div>
        )
      ) : (
        <button
          type="button"
          onClick={pick}
          style={boxStyle}
          className={
            "flex flex-col items-center justify-center gap-1 border border-dashed border-hairline bg-paper text-muted transition hover:border-terracotta hover:text-ink " +
            shape +
            " " +
            boxSize
          }
        >
          <span className="text-2xl leading-none text-terracotta">＋</span>
          {!circle && <span className="text-sm">Add {label.toLowerCase()}</span>}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={pickFile}
        className="hidden"
      />

      <Modal
        open={!!src}
        onClose={uploading ? () => {} : closeModal}
        title={`Crop ${label.toLowerCase()}`}
      >
        <div className="space-y-4">
          <div
            className="relative w-full overflow-hidden rounded-lg bg-ink"
            style={{ aspectRatio: aspect }}
          >
            {src && (
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                cropShape={circle ? "round" : "rect"}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setAreaPixels(pixels)}
              />
            )}
          </div>

          <label className="flex items-center gap-3 text-sm text-muted">
            <span>Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-terracotta"
            />
          </label>

          {uploading && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-hairline">
              <div
                className="h-full rounded-full bg-terracotta transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          )}

          {error && <p className="text-sm text-terracotta">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeModal}
              disabled={uploading}
              className="rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-ink transition hover:bg-paper disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmCrop}
              disabled={uploading || !areaPixels}
              className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-polaroid transition hover:bg-terracotta-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              {uploading ? "Uploading…" : "Use photo"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** Draw the cropped region of `src` onto a canvas and export it as a JPEG blob. */
async function getCroppedBlob(src: string, area: Area): Promise<Blob> {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width);
  canvas.height = Math.round(area.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image.");

  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    area.width,
    area.height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not process image.")),
      "image/jpeg",
      0.92,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () =>
      reject(new Error("Could not load image.")),
    );
    img.src = src;
  });
}
