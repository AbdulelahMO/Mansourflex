"use client";

import { useEffect, useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { archiveBuilding, unarchiveBuilding } from "@/lib/actions/buildings";

/**
 * The non-destructive way to close out a property: it leaves the working lists while every
 * contract, payment and document stays intact for later reference.
 */
export function ArchiveBuildingButton({ buildingId, archived }: { buildingId: string; archived: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error?: string; message?: string } | null>(null);

  useEffect(() => {
    if (result?.error) toast.error(result.error);
    if (result?.message) {
      toast.success(result.message);
      setOpen(false);
    }
  }, [result]);

  function run() {
    startTransition(async () => {
      setResult(await (archived ? unarchiveBuilding(buildingId) : archiveBuilding(buildingId)));
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">
          {archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
          {archived ? "إعادة من الأرشيف" : "أرشفة"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{archived ? "إعادة المبنى للقوائم" : "أرشفة المبنى"}</AlertDialogTitle>
          <AlertDialogDescription>
            {archived
              ? "سيعود المبنى للظهور في قوائم المباني والوحدات وإنشاء العقود."
              : "يختفي المبنى من القوائم العاملة ومن اختيار المباني عند إنشاء عقد، وتبقى عقوده ودفعاته ومستنداته وكشوفه كما هي. مناسب لعقار انتهت إدارتك له، ويمكن التراجع في أي وقت."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction asChild>
            <button
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                run();
              }}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              {archived ? "إعادة" : "أرشفة"}
            </button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
