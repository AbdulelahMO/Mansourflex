import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAGE_SIZE_OPTIONS, paginate, buildPageHref, type PageSizeOption } from "@/lib/pagination";
import { PageSizeSelect } from "@/components/pagination/page-size-select";

type Props = {
  basePath: string;
  total: number;
  page: number;
  size: PageSizeOption;
  extraParams?: Record<string, string>;
};

/** Results-per-page selector + "showing X–Y of Z" range, placed above the list. */
export function PaginationTopBar({ basePath, total, page, size, extraParams }: Props) {
  if (total === 0) return null;
  const { rangeStart, rangeEnd } = paginate(total, page, size);
  const hrefFor = Object.fromEntries(
    PAGE_SIZE_OPTIONS.map((opt) => [opt, buildPageHref(basePath, { size: opt, page: 1 }, extraParams)])
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">عدد النتائج:</span>
        <PageSizeSelect value={size} hrefFor={hrefFor} />
      </div>
      <p className="text-sm text-muted-foreground">
        عرض {rangeStart}–{rangeEnd} من {total}
      </p>
    </div>
  );
}

/** Previous / next page navigation, placed below the list. */
export function PaginationNav({ basePath, total, page, size, extraParams }: Props) {
  const { currentPage, totalPages, pageSize } = paginate(total, page, size);
  if (!pageSize || totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2">
      <Link
        href={buildPageHref(basePath, { size, page: currentPage - 1 }, extraParams)}
        aria-disabled={currentPage <= 1}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium",
          currentPage <= 1 ? "pointer-events-none opacity-40" : "hover:bg-muted"
        )}
      >
        <ChevronRight className="size-4" />
        السابق
      </Link>
      <span className="px-2 text-sm text-muted-foreground">
        صفحة {currentPage} من {totalPages}
      </span>
      <Link
        href={buildPageHref(basePath, { size, page: currentPage + 1 }, extraParams)}
        aria-disabled={currentPage >= totalPages}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium",
          currentPage >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-muted"
        )}
      >
        التالي
        <ChevronLeft className="size-4" />
      </Link>
    </div>
  );
}
