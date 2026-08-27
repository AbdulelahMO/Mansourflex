"use server";

import { requireUser } from "@/lib/session";
import { permissionState, type PermissionState } from "@/lib/authz-core";

/**
 * Lets a control ask what the signed-in user holds for one permission, so a button that
 * will need approval says so before it is pressed instead of after. Read-only, and only
 * ever about the caller's own account.
 */
export async function getPermissionState(key: string): Promise<PermissionState> {
  const user = await requireUser();
  return permissionState(user, key);
}
