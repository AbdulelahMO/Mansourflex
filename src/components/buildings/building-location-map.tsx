"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import "leaflet/dist/leaflet.css";

/**
 * Read-only counterpart of the location picker: shows where the building sits and puts the
 * stored coordinates on screen, so they can be copied out without opening an external map.
 */
export function BuildingLocationMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [copied, setCopied] = useState(false);

  const coordinates = `${lat}, ${lng}`;

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapInstanceRef.current) return;

      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "/leaflet/marker-icon-2x.png",
        iconUrl: "/leaflet/marker-icon.png",
        shadowUrl: "/leaflet/marker-shadow.png",
      });

      // Nothing here is editable, so the map is fixed in place rather than pannable/zoomable.
      const map = L.map(containerRef.current, {
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        zoomControl: false,
        attributionControl: false,
      }).setView([lat, lng], 16);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      L.marker([lat, lng]).addTo(map).bindTooltip(name);

      // The container is measured before the surrounding layout settles, which leaves the map
      // sized to a sliver and most tiles unrequested; re-measure once it has its real box.
      const resize = () => map.invalidateSize();
      requestAnimationFrame(resize);
      const observer = new ResizeObserver(resize);
      if (containerRef.current) observer.observe(containerRef.current);
      observerRef.current = observer;
    });

    return () => {
      cancelled = true;
      observerRef.current?.disconnect();
      observerRef.current = null;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, [lat, lng, name]);

  async function copyCoordinates() {
    try {
      await navigator.clipboard.writeText(coordinates);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="h-56 w-full overflow-hidden rounded-lg border" />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">الإحداثيات</span>
        <code className="rounded-md bg-muted px-2 py-1 text-xs tabular-nums" dir="ltr">
          {coordinates}
        </code>
        <button
          type="button"
          onClick={copyCoordinates}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
        >
          {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
          {copied ? "نُسخت" : "نسخ"}
        </button>
        <a
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
        >
          <ExternalLink className="size-3.5" />
          فتح في الخريطة
        </a>
      </div>
    </div>
  );
}
