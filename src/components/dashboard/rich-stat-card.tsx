import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft } from "lucide-react";

export type StatRowItem = {
  value: string | number;
  label: string;
  tone?: "default" | "danger" | "success";
  iconSrc?: string;
  href?: string;
};

export function RichStatCard({
  icon: Icon,
  mainLabel,
  mainValue,
  mainValueSuffix,
  mainHref,
  rows,
  footerLabel,
  footerHref,
}: {
  icon: LucideIcon;
  mainLabel: string;
  mainValue: string | number;
  mainValueSuffix?: string;
  mainHref?: string;
  rows: StatRowItem[][];
  footerLabel: string;
  footerHref: string;
}) {
  const MainBlock = (
    <div>
      <p className="flex items-baseline gap-1.5 text-2xl font-bold leading-tight">
        {mainValue}
        {mainValueSuffix && <span className="text-sm font-medium text-muted-foreground">{mainValueSuffix}</span>}
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">{mainLabel}</p>
    </div>
  );

  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <div className="mb-3 flex items-start justify-between">
          {mainHref ? (
            <Link href={mainHref} className="rounded-sm transition-opacity hover:opacity-70">
              {MainBlock}
            </Link>
          ) : (
            MainBlock
          )}
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
        </div>

        <div className="space-y-1.5">
          {rows.map((row, i) => (
            <div key={i} className="flex divide-x divide-x-reverse divide-border rounded-lg bg-muted/60">
              {row.map((item, j) => {
                const cellContent = (
                  <>
                    <p
                      className={
                        "text-sm font-bold " +
                        (item.tone === "danger"
                          ? "text-red-600"
                          : item.tone === "success"
                            ? "text-emerald-600"
                            : "text-foreground")
                      }
                    >
                      {item.value}
                    </p>
                    <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                      {item.iconSrc && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.iconSrc} alt="" className="size-4.5 object-contain" />
                      )}
                      {item.label}
                    </p>
                  </>
                );
                return item.href ? (
                  <Link key={j} href={item.href} className="flex-1 rounded-lg py-2 text-center transition-opacity hover:opacity-70">
                    {cellContent}
                  </Link>
                ) : (
                  <div key={j} className="flex-1 py-2 text-center">
                    {cellContent}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <Link
          href={footerHref}
          className="mt-3 flex items-center justify-center gap-1 border-t pt-2.5 text-xs font-medium text-muted-foreground hover:text-primary"
        >
          {footerLabel}
          <ChevronLeft className="size-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
