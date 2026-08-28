"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreVertical, Eye, Pencil } from "lucide-react";
import { updateContractStatus, deleteContract } from "@/lib/actions/contracts";

export function ContractActionsMenu({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function changeStatus(next: "ACTIVE" | "EXPIRED" | "TERMINATED") {
    startTransition(async () => {
      const res = await updateContractStatus(id, next);
      if (res.error) toast.error(res.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteContract(id);
      if (res.error) toast.error(res.error);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={pending}>
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/contracts/${id}`}>
              <Eye className="size-4" />
              عرض العقد
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/contracts/${id}/edit`}>
              <Pencil className="size-4" />
              تعديل العقد
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {status !== "ACTIVE" && <DropdownMenuItem onClick={() => changeStatus("ACTIVE")}>تفعيل العقد</DropdownMenuItem>}
          {status !== "TERMINATED" && <DropdownMenuItem onClick={() => changeStatus("TERMINATED")}>فسخ العقد</DropdownMenuItem>}
          {status !== "EXPIRED" && <DropdownMenuItem onClick={() => changeStatus("EXPIRED")}>إنهاء العقد</DropdownMenuItem>}
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              // Keep the menu's own dismissal from racing the dialog opening.
              e.preventDefault();
              setConfirmOpen(true);
            }}
          >
            حذف العقد
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف العقد</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف العقد نهائياً مع كل دفعاته ومستنداته المالية، وتُصبح الوحدة شاغرة. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction asChild>
              <button
                onClick={remove}
                className="bg-destructive text-white hover:bg-destructive/90 rounded-md px-4 py-2 text-sm"
              >
                حذف
              </button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
