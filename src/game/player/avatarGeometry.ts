import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Unit primitives are shared; each rigid body part is baked into one draw per material.
const sphere = new THREE.SphereGeometry(1, 12, 8);
const matrix = new THREE.Matrix4();
const quaternion = new THREE.Quaternion();
export type Part = [number, number, number, number, number, number];
export function ellipsoids(parts: Part[]) {
  const pieces = parts.map(([x, y, z, sx, sy, sz]) => {
    matrix.compose(
      new THREE.Vector3(x, y, z),
      quaternion,
      new THREE.Vector3(sx, sy, sz),
    );
    return sphere.clone().applyMatrix4(matrix);
  });
  const result = mergeGeometries(pieces);
  pieces.forEach((p) => p.dispose());
  return result;
}
export function silhouette(rings: [number, number][], depth = 0.64) {
  const mesh = new THREE.LatheGeometry(
    rings.map(([r, y]) => new THREE.Vector2(r, y)),
    16,
  );
  mesh.scale(1, 1, depth);
  return mesh;
}
export function identitySeed(identity: string) {
  let seed = 2166136261;
  for (let i = 0; i < identity.length; i++)
    seed = Math.imul(seed ^ identity.charCodeAt(i), 16777619);
  return seed >>> 0;
}
