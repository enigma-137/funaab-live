// Home kitchen (migration 054): cook foodstuff bought from Iya Ibeji and serve it on your Small Table.
// hostel_kitchen in SQL enforces the same rules; scripts/test-home-kitchen-db.ts checks they match.

export type DishLook = 'jollof' | 'noodles' | 'spaghetti' | 'eggs' | 'garri' | 'bread' | 'water';
export type Dish = { item: string; name: string; look: DishLook; cooked: boolean; slot: 'food' | 'drink'; verb: string };

export const DISHES: Dish[] = [
  { item: 'hostel_food_rice', name: 'Jollof rice', look: 'jollof', cooked: true, slot: 'food', verb: 'Cook jollof' },
  { item: 'hostel_food_indomie', name: 'Indomie & egg', look: 'noodles', cooked: true, slot: 'food', verb: 'Cook indomie' },
  { item: 'hostel_food_spaghetti', name: 'Spaghetti', look: 'spaghetti', cooked: true, slot: 'food', verb: 'Cook spaghetti' },
  { item: 'hostel_food_eggs', name: 'Fried eggs', look: 'eggs', cooked: true, slot: 'food', verb: 'Fry eggs' },
  { item: 'hostel_food_garri', name: 'Garri & groundnut', look: 'garri', cooked: false, slot: 'food', verb: 'Soak garri' },
  { item: 'hostel_food_bread', name: 'Bread & tea', look: 'bread', cooked: false, slot: 'food', verb: 'Serve bread' },
  { item: 'hostel_food_water', name: 'Cold water', look: 'water', cooked: false, slot: 'drink', verb: 'Serve water' },
];

export const dishFor = (item: string | null | undefined) => DISHES.find((d) => d.item === item) || null;

/** Food stands on this item's top (SURFACES.hostel_table). */
export const SERVING_TABLE = 'hostel_table';
/** Cooking needs a Pot in your inventory and one of these placed in the room. */
export const COOKING_POT = 'hostel_pot';
export const HEAT_SOURCES = ['hostel_cooker', 'hostel_gas_small_cylinder'];
/** How long the pot steams on screen before the dish is served. */
export const COOK_MS = 4000;

/** Why this dish can't be made right now, or null when it can. */
export function kitchenBlocker(
  dish: Dish,
  have: { owned: (id: string) => number; placed: (id: string) => boolean; served: { food: string | null; drink: string | null } },
): string | null {
  if (!have.placed(SERVING_TABLE)) return 'Place your Small Table first: food is served on the table.';
  if (have.served[dish.slot]) return dish.slot === 'food' ? 'Eat what is on the table first.' : 'Drink the water on the table first.';
  if (dish.cooked && !have.owned(COOKING_POT)) return 'Buy a Pot from Iya Ibeji to cook.';
  if (dish.cooked && !HEAT_SOURCES.some(have.placed)) return 'Place a Gas Cooker or Gas Cylinder to cook.';
  if (!have.owned(dish.item)) return 'Buy it from Iya Ibeji (Shop → Foodstuff).';
  return null;
}
