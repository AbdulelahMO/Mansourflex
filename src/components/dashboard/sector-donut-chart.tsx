import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart } from "lucide-react";

export type SectorSlice = { label: string; count: number; color: string };

const SIZE = 168;
const STROKE = 24;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function SectorDonutChart({ data, total }: { data: SectorSlice[]; total: number }) {
  let cumulative = 0;

  return (
    <Card className="h-full py-0 gap-0">
      <CardHeader className="flex-row items-center justify-between border-b py-3.5">
        <CardTitle className="flex items-center gap-1.5 text-base">
          <PieChart className="size-4 text-muted-foreground" />
          توزيع العقود حسب القطاع
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 items-center p-4">
        {total === 0 ? (
          <div className="flex w-full flex-col items-center gap-2 text-center text-muted-foreground">
            <PieChart className="size-8" />
            <p className="text-sm">لا توجد عقود لعرض توزيعها</p>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-5 sm:flex-row">
            <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
              <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth={STROKE}
                />
                {data.map((slice) => {
                  const pct = slice.count / total;
                  const dash = pct * CIRCUMFERENCE;
                  const dashArray = `${dash} ${CIRCUMFERENCE - dash}`;
                  const dashOffset = -cumulative;
                  cumulative += dash;
                  return (
                    <circle
                      key={slice.label}
                      cx={SIZE / 2}
                      cy={SIZE / 2}
                      r={RADIUS}
                      fill="none"
                      stroke={slice.color}
                      strokeWidth={STROKE}
                      strokeDasharray={dashArray}
                      strokeDashoffset={dashOffset}
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tabular-nums">{total}</span>
                <span className="text-[11px] text-muted-foreground">عقد</span>
              </div>
            </div>

            <div className="w-full flex-1 space-y-2.5">
              {data.map((slice) => {
                const pct = Math.round((slice.count / total) * 100);
                return (
                  <div key={slice.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                      {slice.label}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {slice.count} <span className="text-xs">({pct}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
