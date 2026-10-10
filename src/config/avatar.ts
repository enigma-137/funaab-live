import type { AvatarConfig } from '../types/game';

export const avatarOptions = {
  bodyType: ['masculine', 'feminine'],
  hairstyle: [
    'low-cut',
    'short-afro',
    'fade',
    'short-twists',
    'natural-puff',
    'braids',
    'bun',
    'short-natural',
  ],
  topStyle: ['t-shirt', 'polo', 'shirt', 'hoodie', 'blouse'],
  bottomStyle: ['trousers', 'jeans', 'joggers', 'skirt'],
  shoeStyle: ['sneakers', 'flats'],
} as const;
export const skinTones = ['#c68c63', '#ad7147', '#8d5524', '#663c28', '#3d251e'];
export type StudentAvatar = Required<
  Pick<
    AvatarConfig,
    | 'bodyType'
    | 'skinTone'
    | 'hairstyle'
    | 'hairColor'
    | 'topStyle'
    | 'topColor'
    | 'bottomStyle'
    | 'bottomColor'
    | 'shoeStyle'
    | 'shoeColor'
  >
> &
  AvatarConfig;
const color = (value: unknown, fallback: string) =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
const option = <T extends string>(values: readonly T[], value: unknown, fallback: T): T =>
  values.includes(value as T) ? (value as T) : fallback;
// This allowlist also bounds network payloads and upgrades legacy beta appearances.
export function normalizeAvatar(input?: Partial<AvatarConfig> | null): StudentAvatar {
  const a = input || {};
  const topColor = color(a.topColor ?? a.shirtColor, '#15803d');
  const skinTone = color(a.skinTone ?? a.skinColor, '#8d5524');
  return {
    bodyType: option(
      avatarOptions.bodyType,
      a.bodyType,
      a.gender === 'female' ? 'feminine' : 'masculine',
    ),
    skinTone,
    hairstyle: option(
      avatarOptions.hairstyle,
      a.hairstyle,
      a.hairStyle === 'afro' ? 'short-afro' : 'low-cut',
    ),
    hairColor: color(a.hairColor, '#211b18'),
    topStyle: option(avatarOptions.topStyle, a.topStyle, 't-shirt'),
    topColor,
    bottomStyle: option(avatarOptions.bottomStyle, a.bottomStyle, 'jeans'),
    bottomColor: color(a.bottomColor, '#27364a'),
    shoeStyle: option(avatarOptions.shoeStyle, a.shoeStyle, 'sneakers'),
    shoeColor: color(a.shoeColor, '#eeeeea'),
    shirtColor: topColor,
    skinColor: skinTone,
  };
}
export const stylePresets: Record<string, Partial<AvatarConfig>> = {
  'Campus Casual': {
    topStyle: 't-shirt',
    topColor: '#15803d',
    bottomStyle: 'jeans',
    bottomColor: '#27364a',
    shoeStyle: 'sneakers',
    shoeColor: '#eeeeea',
  },
  'Class Ready': {
    topStyle: 'shirt',
    topColor: '#e6dfcd',
    bottomStyle: 'trousers',
    bottomColor: '#34342f',
    shoeStyle: 'flats',
    shoeColor: '#272522',
  },
  Sporty: {
    topStyle: 'hoodie',
    topColor: '#a84b33',
    bottomStyle: 'joggers',
    bottomColor: '#383d3c',
    shoeStyle: 'sneakers',
    shoeColor: '#eeeeea',
  },
  Soft: {
    topStyle: 'blouse',
    topColor: '#bb8793',
    bottomStyle: 'skirt',
    bottomColor: '#665b72',
    shoeStyle: 'flats',
    shoeColor: '#e6dfcd',
  },
  'Clean Fit': {
    topStyle: 'polo',
    topColor: '#f0ede4',
    bottomStyle: 'trousers',
    bottomColor: '#526249',
    shoeStyle: 'sneakers',
    shoeColor: '#f0ede4',
  },
};
