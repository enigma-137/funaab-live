import { avatarOptions, normalizeAvatar, skinTones } from "./avatar";
import type { AvatarConfig } from "../types/game";

// No randomness or stored-profile migration: the same NPC ID always gets the same outfit.
export function npcAppearance(
  id: string,
  overrides: Partial<AvatarConfig> = {},
) {
  let n = 2166136261;
  for (const c of id) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  const pick = <T>(items: readonly T[]): T => {
    n = Math.imul(n ^ (n >>> 16), 2246822507);
    return items[(n >>> 0) % items.length];
  };
  return normalizeAvatar({
    bodyType: pick(avatarOptions.bodyType),
    skinTone: pick(skinTones),
    hairstyle: pick(avatarOptions.hairstyle),
    topStyle: pick(avatarOptions.topStyle),
    topColor: pick(["#387c76", "#b35e40", "#dab97a", "#687da5", "#a57089"]),
    bottomStyle: pick(avatarOptions.bottomStyle),
    bottomColor: pick(["#26354a", "#514c43", "#394c44"]),
    shoeStyle: pick(avatarOptions.shoeStyle),
    ...overrides,
  });
}
