import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { ItineraryItem, Language } from '../types/tour';

interface Props {
  items: ItineraryItem[];
  lang: Language;
  focusedId?: string | null;
}

export const RouteMap: React.FC<Props> = ({ items, lang, focusedId }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;
    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        center: [23.72, 90.43],
        zoom: 10,
        scrollWheelZoom: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;
    // Clear previous vector layers
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });
    markersRef.current.clear();

    const coords: [number, number][] = [];
    items.forEach((item, idx) => {
      if (item.lat == null || item.lng == null) return;
      const pos: [number, number] = [item.lat, item.lng];
      coords.push(pos);

      const isDest = item.segment_type === 'destination' || item.segment_type === 'food';
      const marker = L.circleMarker(pos, {
        radius: isDest ? 9 : 7,
        color: '#FAF7F0',
        weight: 2,
        fillColor: isDest ? '#C45C3E' : '#14452F',
        fillOpacity: 0.95,
      }).addTo(map);

      marker.bindPopup(
        `<div style="font-family:sans-serif;min-width:160px">
          <div style="font-size:11px;font-weight:700;color:#C45C3E">#${idx + 1} • ${item.time_label}</div>
          <div style="font-size:13px;font-weight:700;margin-top:2px">${lang === 'bn' ? item.title_bn : item.title_en}</div>
          <div style="font-size:11px;color:#444;margin-top:2px">${lang === 'bn' ? item.location_bn : item.location_en}</div>
        </div>`,
      );
      markersRef.current.set(item.id, marker);
    });

    if (coords.length > 1) {
      L.polyline(coords, {
        color: '#14452F',
        weight: 3,
        dashArray: '6 6',
        opacity: 0.8,
      }).addTo(map);
      map.fitBounds(L.latLngBounds(coords), { padding: [36, 36] });
    }
  }, [items, lang]);

  useEffect(() => {
    if (!focusedId || !mapRef.current) return;
    const marker = markersRef.current.get(focusedId);
    if (marker) {
      mapRef.current.setView(marker.getLatLng(), 13, { animate: true });
      marker.openPopup();
    }
  }, [focusedId]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-72 sm:h-96 rounded-3xl overflow-hidden border border-[#14452F]/15 dark:border-white/10 z-0"
    />
  );
};
