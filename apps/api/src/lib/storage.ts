import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { badRequest } from "./http";

const UPLOAD_DIR = fileURLToPath(new URL("../../uploads", import.meta.url));

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export const CONTENT_TYPES: Record<string, string> = { ...Object.fromEntries(Object.entries(EXTENSIONS).map(([type, ext]) => [ext, type])), pdf: "application/pdf" };

/** Saves an uploaded image and returns its storage key. */
export type StorageFolder = "tickets" | "kyc" | "rfq" | "vendor";

export async function saveImage(buffer: Buffer, mimetype: string, folder: StorageFolder): Promise<string> {
  const ext = EXTENSIONS[mimetype];
  if (!ext) throw badRequest("Only JPEG, PNG, WEBP or HEIC images are allowed");
  const key = `${folder}/${randomUUID()}.${ext}`;
  await mkdir(path.join(UPLOAD_DIR, folder), { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, key), buffer);
  return key;
}

const DOC_EXTENSIONS: Record<string, string> = { ...EXTENSIONS, "application/pdf": "pdf" };

/** Saves an uploaded image or PDF (floor plans, GST certificates) and returns its storage key. */
export async function saveDocument(buffer: Buffer, mimetype: string, folder: StorageFolder): Promise<string> {
  const ext = DOC_EXTENSIONS[mimetype];
  if (!ext) throw badRequest("Only JPEG, PNG, WEBP, HEIC images or PDF files are allowed");
  const key = `${folder}/${randomUUID()}.${ext}`;
  await mkdir(path.join(UPLOAD_DIR, folder), { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, key), buffer);
  return key;
}

export async function openFile(key: string) {
  if (!/^(tickets|kyc|rfq|vendor)\/[0-9a-f-]{36}\.[a-z]{3,4}$/.test(key)) return null;
  const filePath = path.join(UPLOAD_DIR, key);
  try {
    await stat(filePath);
  } catch {
    return null;
  }
  const ext = key.split(".").pop()!;
  return { stream: createReadStream(filePath), contentType: CONTENT_TYPES[ext] ?? "application/octet-stream" };
}
