import { execFile } from "child_process";
import { mkdtemp, readFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { recordAudit } from "@/lib/authz-core";

const run = promisify(execFile);

/** Streams a complete backup — database snapshot plus uploads — as one archive. */
export async function GET() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const project = process.cwd();
  const db = path.join(project, "prisma", "dev.db");
  if (!existsSync(db)) {
    return NextResponse.json({ error: "قاعدة البيانات غير موجودة" }, { status: 500 });
  }

  const work = await mkdtemp(path.join(tmpdir(), "pm-backup-"));
  try {
    // VACUUM INTO, never a file copy: copying while the app writes can yield a corrupt
    // snapshot that only reveals itself the day it is needed.
    await run("sqlite3", [db, `VACUUM INTO '${path.join(work, "dev.db")}'`]);

    const check = await run("sqlite3", [path.join(work, "dev.db"), "PRAGMA integrity_check;"]);
    if (check.stdout.trim() !== "ok") {
      return NextResponse.json({ error: `اللقطة تالفة: ${check.stdout.trim()}` }, { status: 500 });
    }

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const archive = path.join(work, `backup-${stamp}.tar.gz`);

    // Attachments travel with the database: deeds, signed agreements, photos and invoices
    // are referenced by it, and a database without them restores to broken links.
    const parts = ["-czf", archive, "-C", work, "dev.db"];
    if (existsSync(path.join(project, "uploads"))) parts.push("-C", project, "uploads");
    await run("tar", parts);

    const data = await readFile(archive);

    await recordAudit({
      user: admin,
      action: "settings.organization",
      summary: `تنزيل نسخة احتياطية (${(data.length / 1024 / 1024).toFixed(1)} ميجابايت)`,
    });

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="backup-${stamp}.tar.gz"`,
        "Content-Length": String(data.length),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "تعذّر إنشاء النسخة" },
      { status: 500 }
    );
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
