import { avatarOptions, normalizeAvatar, skinTones, typicalStyles } from "./avatar";
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
  const bodyType = overrides.bodyType ?? pick(avatarOptions.bodyType);
  const typical = typicalStyles[bodyType];
  return normalizeAvatar({
    bodyType,
    skinTone: pick(skinTones),
    hairstyle: pick(typical.hairstyle),
    topStyle: pick(typical.topStyle),
    topColor: pick(["#387c76", "#b35e40", "#dab97a", "#687da5", "#a57089", "#e7e2d4", "#2f3b55", "#7a2a4a"]),
    bottomStyle: pick(typical.bottomStyle),
    bottomColor: pick(["#26354a", "#514c43", "#394c44", "#1f1f22"]),
    hairColor: pick(["#1a1412", "#211b18", "#211b18", "#3b2a20"]),
    shoeStyle: pick(typical.shoeStyle),
    ...overrides,
  });
}
