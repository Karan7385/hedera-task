// src/components/Map.jsx
import React, { useRef, useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from "react-leaflet";
import L from "leaflet";

const COLORS = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#10b981",
};

function ClickAdd({ onAdd }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      const id = Date.now();
      onAdd({ id, lat, lon: lng, priority: "medium" });
    },
  });
  return null;
}

export default function Map({ points, setPoints, optimizedRoute }) {
  const mapRef = useRef(null);
  const [center, setCenter] = useState(null);
  const initialZoom = 13;

  useEffect(() => {
    if (!navigator.geolocation) {
      setCenter([12.9716, 77.5946]);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter([pos.coords.latitude, pos.coords.longitude]),
      () => setCenter([12.9716, 77.5946]),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const createDotIcon = (color) =>
    L.divIcon({
      html: `<span style="
        display:inline-block;width:16px;height:16px;border-radius:50%;
        border:2px solid white;background:${color};
        box-shadow:0 4px 10px rgba(2,6,23,0.12);
      "></span>`,
      className: "",
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    if (optimizedRoute?.length > 0) {
      const latlngs = optimizedRoute.map((p) => [p.lat, p.lon]);
      map.fitBounds(latlngs, { padding: [40, 40] });
    } else if (points.length > 0) {
      const latlngs = points.map((p) => [p.lat, p.lon]);
      map.fitBounds(latlngs, { padding: [40, 40] });
    } else {
      map.setView(center, initialZoom);
    }
  }, [optimizedRoute, points, center]);

  if (!center) {
    return <div className="w-full h-full flex items-center justify-center text-muted">Getting your location…</div>;
  }

  return (
    <MapContainer whenCreated={(m) => (mapRef.current = m)} center={center} zoom={initialZoom} style={{ height: "100%", width: "100%" }}>
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      <ClickAdd onAdd={(pt) => setPoints(prev => [...prev, pt])} />

      {points.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lon]} icon={createDotIcon(COLORS[p.priority] || COLORS.medium)}>
          <Popup>
            <div className="text-sm">
              <div className="font-semibold">#{p.id}</div>
              <div className="text-xs text-muted">Lat: {p.lat.toFixed(5)}</div>
              <div className="text-xs text-muted">Lon: {p.lon.toFixed(5)}</div>
              <div style={{ marginTop: 6 }}><strong>Priority:</strong> {p.priority}</div>
            </div>
          </Popup>
        </Marker>
      ))}

      {optimizedRoute?.length > 0 && (
        <Polyline positions={optimizedRoute.map(p => [p.lat, p.lon])} weight={4} />
      )}
    </MapContainer>
  );
}