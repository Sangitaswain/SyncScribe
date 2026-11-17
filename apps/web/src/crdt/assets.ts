import * as Y from "yjs";
import { nanoid } from "nanoid";
import { DOC } from "@syncscribe/shared";
import { useStorage } from "../services/storage";

// Images stored inside the document, so they are available offline and sync with it (C10, FP-4.3)

export interface Asset {
  mime: string;
  name: string;
  size: number;
  data: Uint8Array;
}

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
export const MAX_IMAGE = 2 * 1024 * 1024;

/** Why an image can't be added, in plain words; null if it can (EC25, EC34). */
export function imageProblem(file: { name: string; type: string; size: number }) {
  if (!IMAGE_TYPES.includes(file.type)) return `"${file.name}" isn't a supported image. Use PNG, JPEG, GIF or WebP.`;
  if (file.size > MAX_IMAGE) return `"${file.name}" is larger than 2 MB. Please use a smaller image.`;
  if (useStorage.getState().warning === "full") return "Your device storage is full, so new images can't be added right now.";
  return null;
}

/** Stores the image in the doc and returns the markdown that shows it. */
export async function addImage(doc: Y.Doc, file: File) {
  const id = nanoid();
  const asset: Asset = { mime: file.type, name: file.name, size: file.size, data: new Uint8Array(await file.arrayBuffer()) };
  doc.getMap<Asset>(DOC.assets).set(id, asset);
  const alt = file.name.replace(/\.[^.]+$/, "").replace(/[[\]]/g, "");
  return `![${alt}](asset:${id})`;
}

export const assetOf = (doc: Y.Doc, src: string) =>
  src.startsWith("asset:") ? doc.getMap<Asset>(DOC.assets).get(src.slice(6)) : undefined;

export const assetDataUri = (asset: Asset) => {
  let binary = "";
  for (const b of asset.data) binary += String.fromCharCode(b);
  return `data:${asset.mime};base64,${btoa(binary)}`;
};
