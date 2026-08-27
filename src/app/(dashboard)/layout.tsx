import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SidebarNav } from "@/components/sidebar-nav";
import { Topbar } from "@/components/topbar";
import { BottomNav } from "@/components/bottom-nav";
import { BrandMark } from "@/components/brand-mark";
import { navItems } from "@/components/nav-items";
import { statesFor } from "@/lib/authz";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { name, role } = session.user;

  // A temporary password buys access to one screen only: the one that replaces it.
  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true },
  });
  if (account?.mustChangePassword) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (!pathname.startsWith("/account")) redirect("/account");
  }
  const org = await prisma.organizationSettings.findUnique({ where: { id: "default" } });

  // Employees only see the sections their role opens; resolved once per render.
  const navPermissions = [...new Set(navItems.map((i) => i.permission).filter(Boolean) as string[])];
  const states = role === "EMPLOYEE" ? await statesFor(navPermissions) : {};
  const allowed = Object.entries(states)
    .filter(([, state]) => state !== "DENY")
    .map(([key]) => key);
  const orgName = org?.name || "إدارة الأملاك";

  // Owners take no part in approvals; staff see what is waiting on them.
  const pendingApprovals =
    role === "OWNER"
      ? null
      : {
          count: await prisma.approvalRequest.count({
            where: role === "ADMIN" ? { status: "PENDING" } : { status: "PENDING", requestedById: session.user.id },
          }),
          isDecider: role === "ADMIN",
        };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-l md:bg-background print:hidden">
        <div className="flex items-center gap-2 border-b px-4 py-3.5">
          <BrandMark name={orgName} logoUrl={org?.logoUrl} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav role={role} allowed={allowed} />
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <div className="print:hidden">
          <Topbar
            name={name ?? ""}
            role={role}
            orgName={orgName}
            orgLogoUrl={org?.logoUrl}
            pendingApprovals={pendingApprovals}
          />
        </div>
        <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6 print:p-0">{children}</main>
      </div>

      <BottomNav className="print:hidden" />
    </div>
  );
}
