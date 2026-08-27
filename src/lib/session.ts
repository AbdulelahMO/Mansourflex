import "server-only";
import { auth } from "@/auth";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("غير مصرح لك بالدخول");
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("هذا الإجراء متاح لمدير النظام فقط");
  return user;
}

/**
 * Owners only see records tied to their own ownerId. Staff — admins and employees alike —
 * see the whole portfolio; what an employee may *do* is decided by permissions, not by scope.
 */
export function buildingScope(user: { role: "ADMIN" | "OWNER" | "EMPLOYEE"; ownerId: string | null }) {
  if (user.role !== "OWNER") return {};
  return { ownerId: user.ownerId ?? "__none__" };
}
