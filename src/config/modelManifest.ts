/** Metres, Y-up, +Z forward, origin at ground between feet. No model is downloaded yet.
 * Avatar parts share this frame; future GLBs bind to hips/spine/head/hand/foot anchors.
 * Keep config IDs stable when adding asset URLs. Renderer falls back to procedural parts.
 */
export interface ModelAsset {
  url: string;
  scale: number;
  license: string;
}
export const modelManifest: {
  avatars: Partial<
    Record<
      'bodyType' | 'hairstyle' | 'topStyle' | 'bottomStyle' | 'shoeStyle',
      Record<string, ModelAsset>
    >
  >;
  buildings: Record<string, ModelAsset>;
  vehicles: Record<string, ModelAsset>;
} = { avatars: {}, buildings: {}, vehicles: {} };
