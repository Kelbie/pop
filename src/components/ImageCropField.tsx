import { useRef, useState } from "react";
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
 */
export function ImageCropField({
  label,
  aspect,
  value,
  onChange,
  onUploadingChange,
}: {
  label: string;
  aspect: number;
  value: string | null;
  onChange: (url: string | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
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

  return (
    <div className="space-y-1.5">
      <span className="text-sm text-muted">{label}</span>

      {value ? (
        <div className="space-y-2">
          <img
            src={value}
            alt={`${label} preview`}
            style={{ aspectRatio: aspect }}
            className="w-full rounded-lg border border-hairline object-cover"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-paper"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{ aspectRatio: aspect }}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-hairline bg-paper text-sm text-muted transition hover:border-muted hover:text-ink"
        >
          <span className="text-2xl leading-none">＋</span>
          <span>Add {label.toLowerCase()}</span>
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
              className="flex-1"
            />
          </label>

          {uploading && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-hairline">
              <div
                className="h-full rounded-full bg-ink transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

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
              className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-polaroid transition hover:bg-avatar-ink disabled:cursor-not-allowed disabled:opacity-40"
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
