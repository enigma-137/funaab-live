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
    'long-weave',
    'ponytail',
    'bob',
    'locs',
    'big-afro',
    'cornrows',
    'headwrap',
    'bald',
  ],
  topStyle: ['t-shirt', 'polo', 'shirt', 'hoodie', 'blouse', 'jacket', 'jersey', 'kaftan', 'tank-top', 'gown', 'jumpsuit'],
  bottomStyle: ['trousers', 'jeans', 'joggers', 'skirt', 'shorts', 'long-skirt'],
  shoeStyle: ['sneakers', 'flats', 'sandals', 'heels', 'boots'],
} as const;
// Friendlier names for the editor; anything missing shows its id with spaces.
export const optionLabels: Record<string, string> = {
  'low-cut': 'Low cut',
  'short-afro': 'Short afro',
  'short-twists': 'Short twists',
  'natural-puff': 'Afro puff',
  'short-natural': 'Short natural',
  'long-weave': 'Long weave / wig',
  'big-afro': 'Big afro',
  headwrap: 'Gele / headwrap',
  bald: 'Clean shave',
  't-shirt': 'T-shirt',
  kaftan: 'Kaftan / senator',
  'tank-top': 'Tank top',
  jumpsuit: 'Jumpsuit / FPY coverall',
  'long-skirt': 'Long skirt',
  flats: 'Flats / loafers',
};
// What NPCs of each body type are dressed in; players can still wear anything.
export const typicalStyles = {
  masculine: {
    hairstyle: ['low-cut', 'short-afro', 'fade', 'short-twists', 'short-natural', 'locs', 'cornrows', 'bald'],
    topStyle: ['t-shirt', 'polo', 'shirt', 'hoodie', 'jacket', 'jersey', 'kaftan', 'tank-top'],
    bottomStyle: ['trousers', 'jeans', 'joggers', 'shorts'],
    shoeStyle: ['sneakers', 'flats', 'sandals', 'boots'],
  },
  feminine: {
    hairstyle: ['natural-puff', 'braids', 'bun', 'long-weave', 'ponytail', 'bob', 'locs', 'big-afro', 'cornrows', 'headwrap', 'short-natural'],
    topStyle: ['t-shirt', 'blouse', 'shirt', 'hoodie', 'jacket', 'gown', 'kaftan', 'polo'],
    bottomStyle: ['jeans', 'trousers', 'skirt', 'long-skirt', 'joggers'],
    shoeStyle: ['sneakers', 'flats', 'sandals', 'heels', 'boots'],
  },
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
  Street: {
    topStyle: 'jacket',
    topColor: '#2f3b2f',
    bottomStyle: 'jeans',
    bottomColor: '#1f2a3d',
    shoeStyle: 'boots',
    shoeColor: '#5a3a22',
  },
  Baller: {
    topStyle: 'jersey',
    topColor: '#1d4ed8',
    bottomStyle: 'shorts',
    bottomColor: '#1d4ed8',
    shoeStyle: 'sneakers',
    shoeColor: '#f4f4f0',
  },
  Owambe: {
    topStyle: 'kaftan',
    topColor: '#1e3a5f',
    bottomStyle: 'trousers',
    bottomColor: '#1e3a5f',
    shoeStyle: 'flats',
    shoeColor: '#2a1d16',
  },
  'Owambe Gele': {
    hairstyle: 'headwrap',
    topStyle: 'gown',
    topColor: '#8a2252',
    shoeStyle: 'heels',
    shoeColor: '#d4a017',
  },
  FPY: {
    topStyle: 'jumpsuit',
    topColor: '#2f6b2f',
    shoeStyle: 'boots',
    shoeColor: '#2a2522',
  },
  'Sunday Best': {
    topStyle: 'blouse',
    topColor: '#f3e6c4',
    bottomStyle: 'long-skirt',
    bottomColor: '#3b4f7a',
    shoeStyle: 'heels',
    shoeColor: '#2a1d16',
  },
};
// Presets shown only for one body type (the rest suit everyone).
export const presetBodyType: Record<string, 'masculine' | 'feminine'> = {
  Owambe: 'masculine',
  'Owambe Gele': 'feminine',
  'Sunday Best': 'feminine',
  Soft: 'feminine',
};
