import { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Circle, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet';

// Centre par défaut : Casablanca
export const DEFAULT_CENTER = [33.5731, -7.5898];

const toNumber = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const hasCoordinates = (lat, lng) => toNumber(lat) !== null && toNumber(lng) !== null;

function ClickPicker({ onPick }) {
  useMapEvents({
    click(e) {
      onPick?.({ lat: Number(e.latlng.lat.toFixed(7)), lng: Number(e.latlng.lng.toFixed(7)) });
    },
  });
  return null;
}

/** Recentre la carte sur le node (et cadre le cercle du rayon de livraison). */
function FitView({ lat, lng, radiusKm }) {
  const map = useMap();
  useEffect(() => {
    if (lat === null || lng === null) return;
    if (radiusKm && radiusKm > 0) {
      const bounds = L.latLng(lat, lng).toBounds(radiusKm * 2000);
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
    } else {
      map.setView([lat, lng], Math.max(map.getZoom(), 13));
    }
  }, [map, lat, lng, radiusKm]);
  return null;
}

/**
 * Carte OpenStreetMap d'un node : position + cercle du rayon de livraison.
 * - onPick({lat,lng}) : si fourni, un clic sur la carte place le pin.
 * - others : autres nodes à afficher en gris ({ id, name_fr, lat, lng, delivery_radius_km }).
 */
export default function NodeMap({ lat, lng, radiusKm, label, onPick, others = [], height = 420 }) {
  const la = toNumber(lat);
  const ln = toNumber(lng);
  const r = toNumber(radiusKm);
  const hasPos = la !== null && ln !== null;
  const center = hasPos ? [la, ln] : DEFAULT_CENTER;

  return (
    // `isolate` confine les z-index de Leaflet : les modales de la page restent au-dessus.
    <div className="isolate overflow-hidden rounded-xl border border-neutral-200" style={{ height }}>
      <MapContainer center={center} zoom={hasPos ? 13 : 11} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {others
          .filter((o) => hasCoordinates(o.lat, o.lng))
          .map((o) => (
            <CircleMarker
              key={o.id}
              center={[Number(o.lat), Number(o.lng)]}
              radius={5}
              pathOptions={{ color: '#737373', fillColor: '#a3a3a3', fillOpacity: 0.8, weight: 1 }}
            >
              <Tooltip>{o.name_fr}</Tooltip>
            </CircleMarker>
          ))}
        {others
          .filter((o) => hasCoordinates(o.lat, o.lng) && toNumber(o.delivery_radius_km) > 0)
          .map((o) => (
            <Circle
              key={`${o.id}-r`}
              center={[Number(o.lat), Number(o.lng)]}
              radius={Number(o.delivery_radius_km) * 1000}
              pathOptions={{ color: '#a3a3a3', fillOpacity: 0.05, weight: 1, dashArray: '4 4' }}
            />
          ))}
        {hasPos && r > 0 && (
          <Circle
            center={[la, ln]}
            radius={r * 1000}
            pathOptions={{ color: '#E10600', fillColor: '#E10600', fillOpacity: 0.12, weight: 2 }}
          />
        )}
        {hasPos && (
          <CircleMarker
            center={[la, ln]}
            radius={8}
            pathOptions={{ color: '#ffffff', fillColor: '#E10600', fillOpacity: 1, weight: 3 }}
          >
            {label && <Tooltip permanent direction="top" offset={[0, -8]}>{label}</Tooltip>}
          </CircleMarker>
        )}
        {onPick && <ClickPicker onPick={onPick} />}
        <FitView lat={la} lng={ln} radiusKm={r} />
      </MapContainer>
    </div>
  );
}
