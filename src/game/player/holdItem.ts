import { useGameStore } from '../../stores/gameStore';
import { networkManager } from '../multiplayer/networkManager';
import { HELD_ITEM_MS, heldKindFor } from '../../config/heldItems';

/** Put a just-bought item in the student's hand, for them and everyone nearby. */
export function holdPurchasedItem(itemId: string, type?: 'food' | 'drink') {
  const kind = heldKindFor(itemId, type);
  useGameStore.getState().setMyHeldItem({ kind, until: Date.now() + HELD_ITEM_MS });
  networkManager.holdItem(kind);
}
