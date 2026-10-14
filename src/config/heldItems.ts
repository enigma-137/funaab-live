// What a student carries for a minute after buying food or a drink, so the purchase feels real.
// Purely visual: the item is already in the student's Bag on the server.

export const HELD_ITEM_KINDS = ['pack', 'wrap', 'bowl', 'water', 'malt'] as const;
export type HeldKind = (typeof HELD_ITEM_KINDS)[number];
export type HeldItem = { kind: HeldKind; until: number };

/** How long the item stays in hand. */
export const HELD_ITEM_MS = 60_000;
/** Food served on a restaurant table stays until the student stands up, at most this long. */
export const TABLE_ITEM_MS = 10 * 60_000;

export const isHeldKind = (v: unknown): v is HeldKind => HELD_ITEM_KINDS.includes(v as HeldKind);

/** Which prop to show for a purchased item id. */
export function heldKindFor(itemId: string, type?: 'food' | 'drink'): HeldKind {
  const id = itemId.toLowerCase();
  if (id.startsWith('vendor_party_')) return id.includes('malt') ? 'malt' : 'water';
  if (id.includes('malt')) return 'malt';
  if (id.includes('water') || type === 'drink') return 'water';
  if (id.includes('indomie') || id.includes('noodle')) return 'bowl';
  if (id.includes('shawarma') || id.includes('suya')) return 'wrap';
  return 'pack';
}
