// Room makeover: wall paint, floor designs, the paid room expansion and furniture surfaces.
// Prices are mirrored by hostel_finishes / hostel_command in migration 024 (the database is the
// price authority; scripts/test-room-makeover-db.ts checks drift).

export type RoomSize = 'standard' | 'large';

/** Interior half-extents in metres. The large room is wider; depth, door and mattress stay put. */
export const ROOM_SIZES: Record<RoomSize, { halfX: number; halfZ: number }> = {
  standard: { halfX: 4, halfZ: 4 },
  large: { halfX: 5.5, halfZ: 4 },
};
export const ROOM_EXPANSION_PRICE = 50000;
export const roomSizeOf = (size?: string | null): RoomSize => (size === 'large' ? 'large' : 'standard');
/** How far from the centre line furniture may reach along X (walls are 0.2 m in). */
export const roomReachX = (size: RoomSize) => ROOM_SIZES[size].halfX - 0.2;
export const ROOM_REACH_Z = 3.8;

export interface Paint { id: string; label: string; price: number; back: string; side: string }
export const PAINTS: Paint[] = [
  { id: 'default', label: 'Hostel white', price: 0, back: '#e9eddd', side: '#d9e1d3' },
  { id: 'cream', label: 'Cream', price: 3000, back: '#f3e6c4', side: '#eadbb2' },
  { id: 'sky', label: 'Sky blue', price: 3000, back: '#cfe6f5', side: '#bcd9ee' },
  { id: 'mint', label: 'Mint', price: 3000, back: '#cdeedd', side: '#b9e3cc' },
  { id: 'lilac', label: 'Lilac', price: 3000, back: '#e3d7f2', side: '#d5c5ea' },
  { id: 'blush', label: 'Blush pink', price: 3000, back: '#f6d5dc', side: '#efc2cc' },
  { id: 'sunshine', label: 'Sunshine', price: 3000, back: '#f8e7a1', side: '#f2dc84' },
  { id: 'green', label: 'FUNAAB green', price: 3000, back: '#7fbf95', side: '#6bb084' },
  { id: 'navy', label: 'Midnight navy', price: 3000, back: '#34466b', side: '#2b3a5a' },
];

export type FloorPattern = 'plain' | 'speckle' | 'planks' | 'checker' | 'carpet';
export interface FloorStyle { id: string; label: string; price: number; base: string; accent: string; pattern: FloorPattern }
export const FLOORS: FloorStyle[] = [
  { id: 'default', label: 'Bare concrete', price: 0, base: '#c7c7b8', accent: '#b9b9a9', pattern: 'plain' },
  { id: 'terrazzo', label: 'Terrazzo', price: 6000, base: '#e3ddd0', accent: '#9a8f7c', pattern: 'speckle' },
  { id: 'wood', label: 'Wood planks', price: 8000, base: '#b07f4f', accent: '#8c623a', pattern: 'planks' },
  { id: 'tiles', label: 'Checker tiles', price: 7000, base: '#f1f1ec', accent: '#2f3a37', pattern: 'checker' },
  { id: 'carpet', label: 'Wall-to-wall carpet', price: 9000, base: '#7a3e4a', accent: '#8e4c59', pattern: 'carpet' },
];
export const paintById = (id?: string | null) => PAINTS.find((p) => p.id === id) ?? PAINTS[0];
export const floorById = (id?: string | null) => FLOORS.find((f) => f.id === id) ?? FLOORS[0];

/** Furniture you can put things on, and the height of its top. */
export const SURFACES: Record<string, number> = { hostel_table: 0.77, hostel_tv_stand: 0.55 };
export const isSurface = (id: string) => id in SURFACES;
