/**
 * Reistijd hulpfuncties — via backend proxy (Nominatim + OSRM server-side)
 */
import { base44 } from '@/api/base44Client';

const geocodeCache = {};
const reistijdCache = {};

async function proxyCall(action, params) {
  const res = await base44.functions.invoke('reistijdProxy', { action, params });
  return res.data;
}

export async function geocodeAdres(adres, postcode, stad) {
  const parts = [adres, postcode, stad].filter(s => s && s.trim());
  if (!parts.length) return null;
  return geocodeAdresString(parts.join(', '));
}

export async function geocodeAdresString(volledigAdres) {
  if (!volledigAdres?.trim()) return null;
  const key = volledigAdres.trim().toLowerCase();
  if (geocodeCache[key] !== undefined) return geocodeCache[key];

  const result = await proxyCall('geocode', { adres: volledigAdres.trim() });
  geocodeCache[key] = result?.coords ?? null;
  return geocodeCache[key];
}

export async function berekenReistijd(van, naar) {
  if (!van || !naar) return null;
  const key = `${van[0]},${van[1]}-${naar[0]},${naar[1]}`;
  if (reistijdCache[key] !== undefined) return reistijdCache[key];

  const result = await proxyCall('reistijd', { van, naar });
  reistijdCache[key] = result?.minuten ?? null;
  return reistijdCache[key];
}

export function minutesToTime(min) {
  const totalMin = Math.round(min);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}