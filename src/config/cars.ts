// Cars you own (bought in the Iya Ibeji shop, migration 041): drive them on campus and off it,
// burn fuel as you go and fill up at the fuel station. Fuel is kept by the database
// (supabase/migrations/045_cars_fuel.sql; scripts/test-cars-db.ts checks drift).
import { ESTATE } from './estate';
type Point = [number, number, number];

export interface CarModel { id: string; name: string; paint: string; scale: number; suv: boolean; boxy: boolean; topSpeed: number }
export const CAR_MODELS: Record<string, CarModel> = {
  car_picanto: { id: 'car_picanto', name: 'Kia Picanto', paint: '#f59e0b', scale: 0.88, suv: false, boxy: false, topSpeed: 11.5 },
  car_corolla: { id: 'car_corolla', name: 'Toyota Corolla', paint: '#c0c4c8', scale: 1, suv: false, boxy: false, topSpeed: 13 },
  car_camry: { id: 'car_camry', name: 'Toyota Camry', paint: '#1f2937', scale: 1.05, suv: false, boxy: false, topSpeed: 14 },
  car_lexus: { id: 'car_lexus', name: 'Lexus RX 350', paint: '#7f1d1d', scale: 1.1, suv: true, boxy: false, topSpeed: 15 },
  car_gwagon: { id: 'car_gwagon', name: 'Mercedes G-Wagon', paint: '#111111', scale: 1.12, suv: true, boxy: true, topSpeed: 16 },
};
export const isCarId = (id: unknown): id is string => typeof id === 'string' && id in CAR_MODELS;

/** Respray colours (Phone → Garage). Ids are kept by the database (migration 048); a car with no paint wears its model colour. */
export const CAR_PAINTS: Record<string, { name: string; hex: string }> = {
  silver: { name: 'Silver', hex: '#c0c4c8' },
  black: { name: 'Midnight Black', hex: '#111111' },
  white: { name: 'Pearl White', hex: '#f1f5f9' },
  red: { name: 'Racing Red', hex: '#b91c1c' },
  blue: { name: 'Royal Blue', hex: '#1d4ed8' },
  green: { name: 'FUNAAB Green', hex: '#15803d' },
  yellow: { name: 'Taxi Yellow', hex: '#facc15' },
  orange: { name: 'Sunset Orange', hex: '#ea580c' },
  purple: { name: 'Grape Purple', hex: '#7e22ce' },
  pink: { name: 'Candy Pink', hex: '#ec4899' },
};
export const isPaintId = (id: unknown): id is string => typeof id === 'string' && id in CAR_PAINTS;
export const RESPRAY_PRICE = 5000;
/** The colour a car is drawn in: its respray, else the model's own paint. */
export const paintHex = (car: string, paint?: string | null) => (paint && CAR_PAINTS[paint]?.hex) || CAR_MODELS[car]?.paint || CAR_MODELS.car_corolla.paint;

export const FUEL = {
  tankLitres: 40,
  pricePerLitre: 150,
  /** A new car comes with this much in the tank. */
  starterLitres: 10,
  /** Metres you can drive on one litre. */
  metresPerLitre: 250,
  /** The client reports burnt fuel in small steps; the server refuses bigger ones. */
  maxBurnPerReport: 2,
};
export const fuelPrice = (litres: number) => Math.ceil(litres) * FUEL.pricePerLitre;

/** Fuel station on the gate road, east of the lodge. Pull up at a pump to buy fuel. */
export const FUEL_STATION = {
  name: 'Campus Fuel Station',
  centre: [41, 0, 104] as Point,
  size: [12, 8] as [number, number],
  pumps: [[38, 0, 104], [44, 0, 104]] as Point[],
  pumpRadius: 4,
};

/** Where your car waits when you take it out: the estate car park if you rent there, else the campus car park. */
export const CAR_HOME = {
  estate: [ESTATE.carPark.maxX - 2, 0, ESTATE.carPark.minZ + 2.6] as Point,
  campus: [-75, 0, 60] as Point,
};

/** Where the driver sits in the car (car-local; the driver's side is the left, +X). */
export const DRIVER_SEAT: Point = [0.42, 0.02, -0.25];

/** Passenger seats for lifts: front (beside the driver) and back. */
export const PASSENGER_SEATS: Point[] = [[-0.42, 0.02, -0.25], [-0.42, 0.02, -1.25]];
/** Eye height above a seat, for the inside view. */
export const SEAT_EYE = 1.08;

/** Driving feel (metres, seconds, radians). */
export const DRIVE = {
  accel: 6, brake: 12, drag: 3, reverseMax: 4, turnRate: 1.6,
  /** Car body half extents (X, Y, Z) for collisions, before the model's scale. */
  half: [0.95, 0.7, 2.15] as Point,
};
