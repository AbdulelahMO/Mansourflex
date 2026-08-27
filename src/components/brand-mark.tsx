import { Building2 } from "lucide-react";

export function BrandMark({
  name,
  logoUrl,
  iconClassName = "size-6",
  textClassName = "font-bold",
}: {
  name: string;
  logoUrl?: string | null;
  iconClassName?: string;
  textClassName?: string;
}) {
  return (
    <>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/files/${logoUrl}`} alt={name} className={`${iconClassName} w-auto shrink-0 object-contain`} />
      ) : (
        <Building2 className={`${iconClassName} shrink-0 text-primary`} />
      )}
      <span className={`truncate ${textClassName}`}>{name}</span>
    </>
  );
}
