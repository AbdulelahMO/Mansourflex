"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Debounced name search box that updates the `q` query param (and drops `page`) on the given list page. */
export function SearchInput({
  basePath,
  defaultValue,
  placeholder = "بحث بالاسم...",
  extraParams,
}: {
  basePath: string;
  defaultValue: string;
  placeholder?: string;
  extraParams?: Record<string, string>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    if (value === defaultValue) return;
    const handle = setTimeout(() => {
      const qs = new URLSearchParams(extraParams);
      if (value.trim()) qs.set("q", value.trim());
      else qs.delete("q");
      const query = qs.toString();
      router.push(`${basePath}${query ? `?${query}` : ""}`);
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="ps-8 pe-7"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="مسح البحث"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
