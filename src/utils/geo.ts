import { LatLon } from '../types';

/**
 * Convert LatLon (degrees) to Three.js 3D Sphere vector (radius R)
 */
export function latLonToVector3(lat: number, lon: number, radius: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return [x, y, z];
}

/**
 * Calculate Sub-Solar Point from an ISO timestamp for realistic global day/night shading
 */
export function getSubSolarPointFromIso(isoTimestamp: string): LatLon {
  const date = new Date(isoTimestamp);
  const utcHours =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600;

  // Approximate solar declination by day of year
  const startOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000) + 1;
  const declination = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));

  const hoursSinceNoon = utcHours - 12;
  let lon = -(hoursSinceNoon * 15);
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;

  return { lat: declination, lon };
}

/**
 * Format coordinates cleanly for display
 */
export function formatCoords(coords: LatLon): string {
  const latStr = `${Math.abs(coords.lat).toFixed(2)}° ${coords.lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(coords.lon).toFixed(2)}° ${coords.lon >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lonStr}`;
}
