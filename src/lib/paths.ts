import "server-only";
import path from "path";

/**
 * أين تعيش الحالة التي يجب أن تبقى بعد كل نشر.
 *
 * On a developer's machine the database sits under `prisma/` and the attachments under
 * `uploads/`, both inside the checkout. A platform rebuilds the container filesystem on
 * every deploy, so on a server both have to live on a mounted volume instead — which is
 * what `DATABASE_URL` and `UPLOADS_DIR` are for. Neither default differs from the layout
 * the checkout already has: an unset variable changes nothing locally.
 */

/** المرفقات: الصكوك والاتفاقيات الموقّعة وصور العقارات وفواتير الموردين. */
export const UPLOADS_ROOT = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), "uploads");

/**
 * ملف SQLite الذي يشير إليه `DATABASE_URL`، بمسار مطلق.
 *
 * Prisma resolves a relative `file:` URL against the schema's directory rather than the
 * working directory, so `file:./dev.db` means `prisma/dev.db`. The backup has to snapshot
 * the very file the application writes; guessing that path is how a backup ends up being
 * a consistent snapshot of a database nobody is using.
 */
export function sqliteFile(): string | null {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) return null;

  const target = url.slice("file:".length).split("?")[0];
  if (!target) return null;

  return path.isAbsolute(target) ? target : path.resolve(process.cwd(), "prisma", target);
}
