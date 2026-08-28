"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * On a phone a wide table is unreadable sideways, so each row is stacked into a card and every
 * value is captioned with its column heading (see the stacked rules in globals.css). The captions
 * are copied here from the header row rather than repeated on every cell in every page.
 *
 * It is done over the rendered DOM because a table built by a server component reaches this
 * client component as an opaque node: its children cannot be inspected, only what they render.
 * A row whose cells do not line up with the headings is left plain rather than mislabelled.
 */
function useColumnLabels(ref: React.RefObject<HTMLTableElement | null>, enabled: boolean) {
  React.useEffect(() => {
    const table = ref.current
    if (!enabled || !table) return

    const labels = [...table.querySelectorAll(":scope > thead th")].map((th) => th.textContent?.trim() ?? "")
    if (labels.length === 0) return

    for (const row of table.querySelectorAll(":scope > tbody > tr, :scope > tfoot > tr")) {
      const cells = [...row.children]
      if (cells.length !== labels.length) continue
      cells.forEach((cell, i) => {
        if (cell.tagName !== "TD" || cell.hasAttribute("data-label") || cell.hasAttribute("colspan")) return
        cell.setAttribute("data-label", labels[i])
      })
    }
  })
}

function Table({
  className,
  stacked = true,
  ...props
}: React.ComponentProps<"table"> & {
  /** Set false for a table whose rows are not records — a form grid, say — to keep it a table on phones. */
  stacked?: boolean
}) {
  const ref = React.useRef<HTMLTableElement>(null)
  useColumnLabels(ref, stacked)

  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        ref={ref}
        data-slot="table"
        data-stacked={stacked ? "" : undefined}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-muted/60 [&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0 [&>tr:nth-child(even)]:bg-muted/30", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 border-s border-border px-2 text-start align-middle font-medium whitespace-nowrap text-foreground first:border-s-0 [&:has([role=checkbox])]:pe-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "border-s border-border p-2 align-middle whitespace-nowrap first:border-s-0 [&:has([role=checkbox])]:pe-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
