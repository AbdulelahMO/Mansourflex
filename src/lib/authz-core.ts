import { prisma } from "@/lib/prisma";
import { ALWAYS_ADMIN_ONLY, permissionDef } from "@/lib/permissions";

export type PermissionState = "ALLOW" | "APPROVE" | "DENY";

/**
 * The permission a user actually holds, resolved in this order:
 *   1. individual exception on the user, if any
 *   2. the state stored on their role
 *   3. for a "كل شيء ما عدا" role: allowed, unless the permission is sensitive
 * An admin always holds everything; an owner holds nothing here — the owner portal has
 * its own read-only scope and never runs staff actions.
 */
export async function permissionState(
  user: { id: string; role: string },
  key: string
): Promise<PermissionState> {
  if (user.role === "ADMIN") return "ALLOW";
  if (user.role !== "EMPLOYEE") return "DENY";
  if (ALWAYS_ADMIN_ONLY.has(key)) return "DENY";

  const [override, account] = await Promise.all([
    prisma.userPermission.findUnique({ where: { userId_key: { userId: user.id, key } } }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { isActive: true, staffRole: { select: { inheritsAll: true, permissions: { where: { key } } } } },
    }),
  ]);

  // A suspended account keeps its role on paper but can do nothing.
  if (!account?.isActive) return "DENY";
  if (override) return override.state as PermissionState;

  const role = account.staffRole;
  if (!role) return "DENY";

  const fromRole = role.permissions[0];
  if (fromRole) return fromRole.state as PermissionState;

  // Unlisted permission on a catch-all role: inherited unless it is a sensitive one.
  if (role.inheritsAll) return permissionDef(key)?.sensitive ? "DENY" : "ALLOW";
  return "DENY";
}

/** Records what happened, so a permission that was used can be traced back to a person. */
export async function recordAudit(input: {
  user: { id: string; name?: string | null };
  action: string;
  summary: string;
  targetType?: string;
  targetId?: string;
  approvalId?: string;
}) {
  await prisma.auditLog.create({
    data: {
      action: input.action,
      summary: input.summary,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      approvalId: input.approvalId ?? null,
      userId: input.user.id,
      userName: input.user.name ?? "—",
    },
  });
}
