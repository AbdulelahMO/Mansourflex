"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { DeleteButton } from "@/components/delete-button";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { deleteBuildingPhoto, updateBuildingPhotoCaption } from "@/lib/actions/buildings";
import { initialActionState, type ActionState } from "@/lib/types";

export type Photo = { id: string; url: string; caption: string | null };

function CaptionDialog({ photo }: { photo: Photo }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(
    updateBuildingPhotoCaption.bind(null, photo.id),
    initialActionState
  );

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      if (state.message) toast.success(state.message);
    }
  }, [state]);

  return (
    <>
      <Button variant="ghost" size="sm" className="text-xs" title="تعديل الوصف" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>وصف الصورة</DialogTitle>
            <DialogDescription>وصف مختصر يوضّح ما تُظهره الصورة</DialogDescription>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`caption-${photo.id}`}>الوصف</Label>
              <Input
                id={`caption-${photo.id}`}
                name="caption"
                defaultValue={photo.caption ?? ""}
                placeholder="مثال: الواجهة الشمالية"
              />
            </div>
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
            <div className="flex justify-end">
              <SubmitButton>حفظ</SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The building's photo gallery: a click enlarges, and admins can caption or remove. */
export function BuildingGallery({ photos, canManage }: { photos: Photo[]; canManage: boolean }) {
  const [preview, setPreview] = useState<Photo | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo) => (
          <figure key={photo.id} className="overflow-hidden rounded-lg border">
            <button
              type="button"
              onClick={() => setPreview(photo)}
              className="block w-full cursor-zoom-in"
              title="تكبير الصورة"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/files/${photo.url}`}
                alt={photo.caption ?? ""}
                className="h-36 w-full object-cover transition hover:opacity-90"
              />
            </button>
            <figcaption className="flex items-center justify-between gap-1 px-2 py-1.5 text-xs">
              <span className="truncate text-muted-foreground" title={photo.caption ?? ""}>
                {photo.caption || "بلا وصف"}
              </span>
              {canManage && (
                <span className="flex shrink-0 items-center">
                  <CaptionDialog photo={photo} />
                  <DeleteButton
                    action={deleteBuildingPhoto.bind(null, photo.id)}
                    title="حذف الصورة"
                    description="سيتم حذف الصورة من معرض العقار نهائياً."
                  />
                </span>
              )}
            </figcaption>
          </figure>
        ))}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.caption || "صورة العقار"}</DialogTitle>
          </DialogHeader>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/files/${preview.url}`}
              alt={preview.caption ?? ""}
              className="max-h-[70vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
