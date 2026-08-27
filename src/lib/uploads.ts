import "server-only";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function saveUploadedFile(file: File, subdir: string): Promise<string> {
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error("صيغة الملف غير مدعومة (المسموح: PDF, PNG, JPG, WEBP)");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("حجم الملف أكبر من الحد المسموح (10 ميجابايت)");
  }

  const dir = path.join(UPLOADS_ROOT, subdir);
  await mkdir(dir, { recursive: true });

  const filename = `${crypto.randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  return `${subdir}/${filename}`;
}

/** Resolves a stored relative path to an absolute path, rejecting any path traversal attempt. */
export function resolveUploadPath(relativePath: string): string | null {
  const resolved = path.normalize(path.join(UPLOADS_ROOT, relativePath));
  if (!resolved.startsWith(UPLOADS_ROOT + path.sep)) return null;
  return resolved;
}
