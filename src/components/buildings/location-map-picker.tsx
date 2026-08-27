"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: [number, number] = [24.7136, 46.6753]; // الرياض

export function LocationMapPicker({
  initialLat,
  initialLng,
  onResolved,
}: {
  initialLat?: number | null;
  initialLng?: number | null;
  onResolved: (result: { lat: number; lng: number; address: Record<string, string>; displayName?: string }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasPoint, setHasPoint] = useState(Boolean(initialLat && initialLng));

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapInstanceRef.current) return;

      // Leaflet's default marker icon paths break under bundlers; serve the images ourselves
      // so the pin never depends on an outside CDN staying reachable.
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "/leaflet/marker-icon-2x.png",
        iconUrl: "/leaflet/marker-icon.png",
        shadowUrl: "/leaflet/marker-shadow.png",
      });

      const start: [number, number] = initialLat && initialLng ? [initialLat, initialLng] : DEFAULT_CENTER;
      const map = L.map(containerRef.current).setView(start, initialLat ? 16 : 6);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      if (initialLat && initialLng) {
        markerRef.current = L.marker(start).addTo(map);
      }

      map.on("click", async (e: import("leaflet").LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        setHasPoint(true);
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng]).addTo(map);
        }

        setLoading(true);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar&addressdetails=1`
          );
          const data = await res.json();
          onResolved({ lat, lng, address: data?.address ?? {}, displayName: data?.display_name });
        } catch {
          onResolved({ lat, lng, address: {} });
        } finally {
          setLoading(false);
        }
      });
    });

    return () => {
      cancelled = true;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <MapPin className="size-3.5" />
        حدد موقع العقار على الخريطة
        {loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      </div>
      <div ref={containerRef} className="isolate h-64 w-full overflow-hidden rounded-lg border" />
      {!hasPoint && <p className="text-xs text-muted-foreground">اضغط على الخريطة لتحديد موقع العقار واستخراج العنوان تلقائياً</p>}
    </div>
  );
}
