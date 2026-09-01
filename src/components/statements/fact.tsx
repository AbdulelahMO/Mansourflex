/**
 * A labelled fact in a statement's head — who it is about, and by what numbers.
 *
 * Every value is fenced in `bdi`: an Arabic label butting against Latin digits lets the bidi
 * algorithm run the two together, and «هوية 1188179739» beside «جوال 0581939603» came out as a
 * single 21-digit number. An empty value renders nothing at all, so a head made of eight facts
 * shows only the ones this owner or tenant actually has.
 */
export function Fact({
  label,
  value,
  note,
}: {
  label: string;
  value: string | null | undefined;
  note?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">
        <bdi>{value}</bdi>
      </dd>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
