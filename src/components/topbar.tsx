"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/sidebar-nav";
import { UserMenu } from "@/components/user-menu";
import { BrandMark } from "@/components/brand-mark";

export function Topbar({
  name,
  role,
  orgName,
  orgLogoUrl,
}: {
  name: string;
  role: "ADMIN" | "OWNER" | "EMPLOYEE";
  orgName: string;
  orgLogoUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur px-3 md:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-72 p-0">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="flex items-center gap-2">
              <BrandMark name={orgName} logoUrl={orgLogoUrl} iconClassName="size-5" />
            </SheetTitle>
          </SheetHeader>
          <SidebarNav role={role} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex items-center gap-2 md:hidden">
        <BrandMark name={orgName} logoUrl={orgLogoUrl} iconClassName="size-5" textClassName="text-sm font-bold" />
      </div>

      <div className="flex-1" />
      <span className="hidden truncate text-sm font-medium text-muted-foreground md:inline max-w-48">{orgName}</span>
      <UserMenu name={name} role={role} />
    </header>
  );
}
