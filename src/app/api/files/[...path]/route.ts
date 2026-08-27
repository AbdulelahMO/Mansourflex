import { readFile, stat } from "fs/promises";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { resolveUploadPath } from "@/lib/uploads";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(_request: Request, ctx: RouteContext<"/api/files/[...path]">) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { path: segments } = await ctx.params;
  const relativePath = segments.join("/");
  const absolutePath = resolveUploadPath(relativePath);
  if (!absolutePath) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  try {
    await stat(absolutePath);
    const buffer = await readFile(absolutePath);
    const ext = "." + (relativePath.split(".").pop() ?? "");
    const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
    return new NextResponse(buffer, { headers: { "Content-Type": contentType } });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
