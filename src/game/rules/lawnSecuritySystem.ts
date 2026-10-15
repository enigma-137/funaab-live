import worldData from '../../config/campusWorld';
import { ECONOMY_CONFIG } from '../../config/economy';
import { TerrainZone, SecurityRoute } from '../../types/game';

const terrainZones = worldData.terrainZones as TerrainZone[];
const securityRoutes = worldData.securityRoutes as SecurityRoute[];

export interface TerrainClassification {
  type: 'road' | 'path' | 'lawn' | 'sports' | 'building' | 'plaza' | 'carpark';
  name: string;
  restricted: boolean;
}

/**
 * Classifies the exact terrain under the player's feet based on coordinates.
 * Priority hierarchy:
 * 1. Buildings (interiors & covered pavilions) -> safe
 * 2. Sports Centre grass turf -> safe (legal athletic zone)
 * 3. Paved walkways & pedestrian footpaths -> safe
 * 4. Plazas & Car parks -> safe
 * 5. Asphalt roads & crossings -> safe
 * 6. Explicit restricted campus lawns -> RESTRICTED (illegal walking)
 */
export function classifyTerrain(x: number, z: number): TerrainClassification {
  // 1. Check building zones
  for (const zone of terrainZones) {
    if (zone.type === 'building' && isInside(x, z, zone.bounds)) {
      return { type: zone.type, name: zone.name, restricted: false };
    }
  }

  // 2. Check sports turf (Sports Centre is 100% legal to walk/play on)
  for (const zone of terrainZones) {
    if (zone.type === 'sports' && isInside(x, z, zone.bounds)) {
      return { type: zone.type, name: zone.name, restricted: false };
    }
  }

  // 3. Check paved pedestrian paths & walkways
  for (const zone of terrainZones) {
    if (zone.type === 'path' && isInside(x, z, zone.bounds)) {
      return { type: zone.type, name: zone.name, restricted: false };
    }
  }

  // 4. Check plazas & car park
  for (const zone of terrainZones) {
    if ((zone.type === 'plaza' || zone.type === 'carpark') && isInside(x, z, zone.bounds)) {
      return { type: zone.type, name: zone.name, restricted: false };
    }
  }

  // 5. Check road corridors
  for (const zone of terrainZones) {
    if (zone.type === 'road' && isInside(x, z, zone.bounds)) {
      return { type: zone.type, name: zone.name, restricted: false };
    }
  }

  // 6. Check restricted lawn areas
  for (const zone of terrainZones) {
    if (zone.type === 'lawn' && zone.restricted && isInside(x, z, zone.bounds)) {
      return { type: zone.type, name: zone.name, restricted: true };
    }
  }

  // Default fallback
  return { type: 'path', name: 'Campus Grounds', restricted: false };
}

function isInside(x: number, z: number, bounds: { minX: number; maxX: number; minZ: number; maxZ: number }) {
  return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
}

// Local violation state tracking
class LawnEnforcementManager {
  private finedForCurrentLawnStay = false;
  private lastFineTime = 0;
  private wasOnLawn = false;

  public checkEnforcement(
    playerPos: [number, number, number],
    officers: { id: string; name: string; position: [number, number, number]; detectionRadius: number }[]
  ): { caught: boolean; officerName?: string; fineAmount?: number; officerId?: string } {
    const [px, , pz] = playerPos;
    const terrain = classifyTerrain(px, pz);

    if (!terrain.restricted) {
      // Returned to legal road, path, sports field, or building
      if (this.wasOnLawn) {
        this.finedForCurrentLawnStay = false;
        this.wasOnLawn = false;
      }
      return { caught: false };
    }

    // Player is currently standing on restricted lawn!
    this.wasOnLawn = true;

    // If already fined for this lawn stay, do NOT repeat charge (anti-spam)
    if (this.finedForCurrentLawnStay) {
      return { caught: false };
    }

    // Cooldown check (20 seconds safety margin)
    const now = Date.now();
    if (now - this.lastFineTime < 20000) {
      return { caught: false };
    }

    // Check distance to nearby Security Officers
    for (const officer of officers) {
      const [ox, , oz] = officer.position;
      const dx = px - ox;
      const dz = pz - oz;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= officer.detectionRadius) {
        // CAUGHT!
        this.finedForCurrentLawnStay = true;
        this.lastFineTime = now;
        return {
          caught: true,
          officerName: officer.name,
          fineAmount: ECONOMY_CONFIG.LAWN_FINE,
          officerId: officer.id,
        };
      }
    }

    return { caught: false };
  }

  public reset() {
    this.finedForCurrentLawnStay = false;
    this.lastFineTime = 0;
    this.wasOnLawn = false;
  }
}

export const lawnEnforcement = new LawnEnforcementManager();
