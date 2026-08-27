"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyWebhookUrl({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        const url = `${window.location.origin}${path}`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-mono text-muted-foreground hover:text-foreground"
      dir="ltr"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {path}
    </button>
  );
}
