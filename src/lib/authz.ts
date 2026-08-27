import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { permissionLabel } from "@/lib/permissions";
import { permissionState, recordAudit } from "@/lib/authz-core";

export { permissionState, recordAudit };
export type { PermissionState } from "@/lib/authz-core";
import type { PermissionState as PermissionStateValue } from "@/lib/authz-core";

export class PermissionError extends Error {
  constructor(public readonly key: string) {
    super(`لا تملك صلاحية «${permissionLabel(key)}»`);
  }
}

export class ApprovalRequired extends Error {
  constructor(public readonly key: string) {
    super(`«${permissionLabel(key)}» يحتاج موافقة مدير النظام`);
  }
}

/**
 * Guard for a server action. Throws when the permission is denied, and signals the caller
 * when the action must go through an approval request instead of running now.
 */
export async function requirePermission(key: string) {
  const user = await requireUser();
  const state = await permissionState(user, key);
  if (state === "DENY") throw new PermissionError(key);
  return { user, needsApproval: state === "APPROVE" };
}

/**
 * Page-level gate: a section the user cannot reach at all is a 404 rather than an error,
 * so nothing leaks about records they are not meant to know exist.
 */
export async function requirePagePermission(key: string) {
  const user = await requireUser();
  if ((await permissionState(user, key)) === "DENY") notFound();
  return user;
}

/** Convenience for pages: what the current user may see/do, without throwing. */
export async function can(key: string) {
  const user = await requireUser();
  return (await permissionState(user, key)) !== "DENY";
}

export async function statesFor(keys: string[]) {
  const user = await requireUser();
  const entries = await Promise.all(keys.map(async (k) => [k, await permissionState(user, k)] as const));
  return Object.fromEntries(entries) as Record<string, PermissionStateValue>;
}

