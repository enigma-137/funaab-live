import { useGameStore } from '../../stores/gameStore';
import { networkManager } from '../multiplayer/networkManager';
import { HELD_ITEM_MS, TABLE_ITEM_MS, heldKindFor, type HeldKind } from '../../config/heldItems';
import { diningSpotAt } from '../../config/campusWorld';

const atTable = () => {
  const seat = useGameStore.getState().seatedAt;
  return !!seat && seat.animation !== 'sleep' && !!diningSpotAt(seat.position);
};

function show(kind: HeldKind, ms: number) {
  useGameStore.getState().setMyHeldItem(ms > 0 ? { kind, until: Date.now() + ms } : null);
  networkManager.holdItem(kind, ms);
}

/**
 * Show a just-bought item, for this student and everyone nearby: in hand for a minute, or on the
 * table in front of them when they're seated at Floral World or the Buka.
 */
export function holdPurchasedItem(itemId: string, type?: 'food' | 'drink') {
  watchSeating();
  show(heldKindFor(itemId, type), atTable() ? TABLE_ITEM_MS : HELD_ITEM_MS);
}

// Sitting down at a restaurant table puts what you're holding on the table; standing up clears it.
// Installed on the first purchase (nothing to place before that), which also avoids import cycles.
let watching = false;
function watchSeating() {
  if (watching) return;
  watching = true;
  let wasAtTable = atTable();
  useGameStore.subscribe((s, prev) => {
    if (s.seatedAt === prev.seatedAt) return;
    const now = atTable();
    const item = s.myHeldItem;
    if (now && !wasAtTable && item && item.until > Date.now()) show(item.kind, TABLE_ITEM_MS);
    if (!now && wasAtTable && item) show(item.kind, 0);
    wasAtTable = now;
  });
}
