import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/**
 * Opens a file picker for an image, reads it, and returns a base64 data URL
 * ready to store directly on a Student/Teacher record (used for ID cards).
 * Returns null if the user cancels.
 */
export async function pickAndEncodePhoto(): Promise<string | null> {
  const path = await open({
    multiple: false,
    filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp"] }],
  });
  if (!path || Array.isArray(path)) return null;

  const ext = path.split(".").pop()?.toLowerCase() ?? "png";
  const mime = MIME_BY_EXT[ext] ?? "image/png";

  const bytes = await readFile(path);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);

  return `data:${mime};base64,${base64}`;
}
