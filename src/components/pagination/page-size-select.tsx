"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LABELS: Record<string, string> = { "10": "10", "25": "25", "50": "50", all: "الكل" };

export function PageSizeSelect({ value, hrefFor }: { value: string; hrefFor: Record<string, string> }) {
  const router = useRouter();

  return (
    <Select value={value} onValueChange={(v) => v && router.push(hrefFor[v])}>
      <SelectTrigger size="sm" className="w-20">
        <SelectValue>{LABELS[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.keys(hrefFor).map((opt) => (
          <SelectItem key={opt} value={opt}>
            {LABELS[opt]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
