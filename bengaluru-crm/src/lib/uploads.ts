import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { UPLOAD_DIR } from "./db";
import { HttpError } from "./api";

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
};
export const AUDIO_TYPES: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};
export const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  webm: "audio/webm",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

const SAFE = /^[A-Za-z0-9._-]+$/;

export function safeSegment(s: string) {
  if (!SAFE.test(s) || s.includes("..")) throw new HttpError("Invalid path", 400);
  return s;
}

export async function saveUpload(kind: "photos" | "recordings", businessId: string, file: File, allowed: Record<string, string>, maxBytes: number) {
  const baseType = (file.type || "").split(";")[0].trim().toLowerCase();
  const ext = allowed[baseType];
  if (!ext) throw new HttpError(`Unsupported file type: ${file.type || "unknown"}`, 415);
  if (file.size > maxBytes) throw new HttpError(`File too large (max ${Math.round(maxBytes / 1_000_000)} MB)`, 413);
  const dir = path.join(UPLOAD_DIR, kind, safeSegment(businessId));
  await fs.promises.mkdir(dir, { recursive: true });
  const fileName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  await fs.promises.writeFile(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()));
  return { fileName, mimeType: baseType };
}

export async function removeUpload(kind: "photos" | "recordings", businessId: string, fileName: string) {
  const p = path.join(UPLOAD_DIR, kind, safeSegment(businessId), safeSegment(fileName));
  await fs.promises.rm(p, { force: true });
}
