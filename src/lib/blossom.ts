// ---------------------------------------------------------------------------
// Blossom — browser-side blob upload, signed through the active NDK signer.
//
// Adapted from sovran-admin-panel/src/lib/blossom.ts. That version signs the
// BUD-11 auth event with `window.nostr` directly; Pop supports extension, nsec
// and bunker logins (see store/auth.ts), so we sign the kind-24242 event with
// `ndk.signer` instead — otherwise uploads break for everyone not using a
// NIP-07 extension. The blob URL is deterministic (`server/{sha256}`), so we
// build it ourselves and skip parsing the server response.
// ---------------------------------------------------------------------------

import { NDKEvent, type NDKKind } from "@nostr-dev-kit/ndk";
import { ndk } from "./ndk";

const BLOSSOM_AUTH_KIND = 24242 as unknown as NDKKind;

export const DEFAULT_BLOSSOM_SERVERS = [
  "https://blossom.primal.net",
  "https://cdn.nostr.build",
];

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

export async function calculateHash(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function blobUrl(serverUrl: string, hash: string): string {
  return `${serverUrl.replace(/\/$/, "")}/${hash}`;
}

// ---------------------------------------------------------------------------
// Blossom auth — kind 24242 signed via the active NDK signer
// ---------------------------------------------------------------------------

async function createBlossomAuthHeader(
  action: "upload" | "get" | "delete" | "list",
  sha256Hash: string,
  expirationSecs = 3600,
): Promise<string> {
  if (!ndk.signer) throw new Error("Log in to upload images.");

  const now = Math.floor(Date.now() / 1000);
  const tags: string[][] = [
    ["t", action],
    ["expiration", String(now + expirationSecs)],
  ];
  if (action !== "list") tags.push(["x", sha256Hash]);

  const event = new NDKEvent(ndk);
  event.kind = BLOSSOM_AUTH_KIND;
  event.created_at = now;
  event.tags = tags;
  event.content = `Authorize ${action} for ${sha256Hash}`;
  await event.sign();

  // BUD-11: base64url (no padding, URL-safe) of the full signed event.
  const json = JSON.stringify(event.rawEvent());
  const b64 = btoa(json)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `Nostr ${b64}`;
}

// ---------------------------------------------------------------------------
// Blob operations
// ---------------------------------------------------------------------------

async function checkBlob(hash: string, serverUrl: string): Promise<boolean> {
  try {
    const response = await fetch(blobUrl(serverUrl, hash), { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Upload an image blob to a Blossom server, returning its URL.
 *
 * Dedupes against the server first (HEAD by sha256), signs a BUD-11 auth event
 * via `ndk.signer`, then PUTs the blob with upload-progress reporting.
 */
export async function uploadImageBlob(
  blob: Blob,
  onProgress?: (progress: number) => void,
  serverUrl: string = DEFAULT_BLOSSOM_SERVERS[0],
): Promise<string> {
  const data = new Uint8Array(await blob.arrayBuffer());
  const mimeType = blob.type || "image/jpeg";

  const hash = await calculateHash(data);
  onProgress?.(0.1);

  if (await checkBlob(hash, serverUrl)) {
    onProgress?.(1);
    return blobUrl(serverUrl, hash);
  }
  onProgress?.(0.2);

  const authHeader = await createBlossomAuthHeader("upload", hash);
  onProgress?.(0.3);

  const uploadUrl = `${serverUrl.replace(/\/$/, "")}/upload`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.setRequestHeader("X-SHA-256", hash);
    xhr.setRequestHeader("Authorization", authHeader);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress?.(0.3 + (e.loaded / e.total) * 0.7);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        // Prefer the server's reported url, fall back to the deterministic one.
        let url = blobUrl(serverUrl, hash);
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (typeof parsed?.url === "string") url = parsed.url;
        } catch {
          /* non-JSON response — the deterministic url is correct */
        }
        resolve(url);
      } else {
        reject(
          new Error(`Upload failed (${xhr.status}). Please try again.`),
        );
      }
    });

    xhr.addEventListener("error", () =>
      reject(new Error("Upload failed — network error.")),
    );

    xhr.send(new Blob([data], { type: mimeType }));
  });
}
