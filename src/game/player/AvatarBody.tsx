import React, { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AvatarConfig } from "../../types/game";
import { normalizeAvatar } from "../../config/avatar";
import type { HeldItem } from "../../config/heldItems";
import { HeldProp } from "./HeldProp";
import {
  ellipsoids,
  silhouette,
  identitySeed,
  type Part,
} from "./avatarGeometry";

export const AvatarBody = memo(
  ({
    config,
    animation = "idle",
    identity = "",
    trackMovement = false,
    accessory,
    held,
  }: {
    config: AvatarConfig;
    animation?: string;
    identity?: string;
    trackMovement?: boolean;
    accessory?: "security";
    /** Food or drink just bought, carried in the right hand until it expires. */
    held?: HeldItem | null;
  }) => {
    const a = useMemo(() => normalizeAvatar(config), [config]);
    const seed = identitySeed(
      identity || `${a.skinTone}/${a.hairstyle}/${a.bodyType}`,
    );
    const near = useRef<THREE.Group>(null),
      far = useRef<THREE.Group>(null);
    const root = useRef<THREE.Group>(null),
      chest = useRef<THREE.Group>(null),
      head = useRef<THREE.Group>(null);
    const legs = useRef<(THREE.Group | null)[]>([]),
      knees = useRef<(THREE.Group | null)[]>([]);
    const skirt = useRef<THREE.Group>(null);
    const ankles = useRef<(THREE.Group | null)[]>([]);
    const heldRef = useRef<THREE.Group>(null);
    const arms = useRef<(THREE.Group | null)[]>([]),
      elbows = useRef<(THREE.Group | null)[]>([]);
    const motion = useRef({
      previous: new THREE.Vector3(),
      world: new THREE.Vector3(),
      initialized: false,
      phase: seed % 100,
      blend: 0,
    });
    const width =
      (a.bodyType === "feminine" ? 0.245 : 0.275) * (0.96 + (seed % 7) * 0.013);
    const resources = useMemo(() => {
      const g: Record<string, THREE.BufferGeometry> = {};
      const e = (name: string, parts: Part[]) => (g[name] = ellipsoids(parts));
      const faceWidth = 0.173 + (seed % 5) * 0.004;
      e("head", [
        [0, 0, 0, faceWidth, 0.235, 0.174],
        [0, -0.116, 0.043, 0.128, 0.115, 0.132],
        [-faceWidth, -0.01, 0, 0.038, 0.065, 0.032],
        [faceWidth, -0.01, 0, 0.038, 0.065, 0.032],
        [0, -0.025, 0.166, 0.036, 0.048, 0.045],
      ]);
      e(
        "white",
        [-1, 1].map(
          (s) => [s * 0.069, 0.032, 0.158, 0.042, 0.023, 0.017] as Part,
        ),
      );
      e(
        "features",
        [-1, 1]
          .flatMap(
            (s) =>
              [
                [s * 0.067, 0.03, 0.176, 0.015, 0.018, 0.008],
                [s * 0.069, 0.084, 0.157, 0.048, 0.01, 0.012],
              ] as Part[],
          )
          .concat([
            [-0.027, -0.091, 0.16, 0.027, 0.006, 0.009],
            [0.027, -0.091, 0.16, 0.027, 0.006, 0.009],
            [0, -0.098, 0.161, 0.025, 0.006, 0.009],
          ]),
      );
      const hair: Part[] = [[0, 0.133, -0.026, 0.184, 0.115, 0.168]];
      if (
        ["short-afro", "short-natural", "natural-puff"].includes(a.hairstyle)
      ) {
        for (let i = 0; i < 18; i++) {
          const t = i * 2.39996,
            y = 0.17 + (i % 3) * 0.045;
          hair.push([
            Math.cos(t) * 0.146,
            y,
            Math.sin(t) * 0.134 - 0.02,
            0.091,
            0.09,
            0.083,
          ]);
        }
      }
      if (a.hairstyle === "fade")
        hair.push([0, 0.188, -0.016, 0.157, 0.07, 0.146]);
      if (["bun", "natural-puff"].includes(a.hairstyle))
        hair.push([
          0,
          0.24,
          -0.12,
          a.hairstyle === "bun" ? 0.105 : 0.16,
          0.14,
          0.13,
        ]);
      if (["braids", "short-twists"].includes(a.hairstyle)) {
        for (let i = 0; i < 12; i++) {
          const t = (i * Math.PI * 2) / 12;
          const front = Math.sin(t) > 0.45;
          hair.push([
            Math.cos(t) * 0.16,
            a.hairstyle === "braids" && !front ? -0.06 : 0.17,
            Math.sin(t) * 0.14 - 0.03,
            0.027,
            a.hairstyle === "braids" && !front ? 0.24 : 0.086,
            0.029,
          ]);
        }
      }
      e("hair", hair);
      g.torso = silhouette(
        [
          [0, 0.9],
          [width * 0.75, 0.9],
          [width * 0.85, 0.96],
          [width * 0.81, 1.1],
          [width, 1.37],
          [width * 0.94, 1.46],
          [0.115, 1.51],
          [0, 1.51],
        ],
        0.66,
      );
      e("neck", [[0, 1.53, 0, 0.085, 0.12, 0.08]]);
      e("hips", [[0, 0.89, 0, width * 0.83, 0.13, 0.15]]);
      g.upperLeg = silhouette(
        [
          [0, -0.435],
          [0.073, -0.435],
          [0.09, -0.31],
          [0.108, -0.12],
          [0.098, 0.025],
          [0, 0.025],
        ],
        1,
      );
      g.lowerLeg = silhouette(
        [
          [0, -0.42],
          [0.061, -0.42],
          [0.065, -0.3],
          [0.082, -0.12],
          [0.074, 0.025],
          [0, 0.025],
        ],
        1,
      );
      e("shoe", [[0, 0.067, 0.048, 0.095, 0.067, 0.17]]);
      e("sole", [[0, 0.026, 0.048, 0.097, 0.026, 0.174]]);
      e("upperArm", [[0, -0.145, 0, 0.075, 0.19, 0.08]]);
      e("sleeve", [
        [0, -0.08, 0, a.topStyle === "hoodie" ? 0.098 : 0.089, 0.139, 0.09],
      ]);
      e("forearm", [[0, -0.12, 0, 0.059, 0.154, 0.065]]);
      e("hand", [
        [0, -0.275, 0.008, 0.059, 0.078, 0.035],
        [0.044, -0.25, 0.022, 0.02, 0.04, 0.024],
      ]);
      const trim: Part[] = [[0, 1.489, 0.015, 0.115, 0.024, 0.085]];
      if (["shirt", "polo"].includes(a.topStyle))
        trim.push(
          [-0.065, 1.45, 0.106, 0.05, 0.059, 0.017],
          [0.065, 1.45, 0.106, 0.05, 0.059, 0.017],
        );
      if (a.topStyle === "shirt") trim.push([0, 1.2, 0.171, 0.01, 0.24, 0.009]);
      if (a.topStyle === "hoodie")
        trim.push(
          [0, 1.43, -0.128, 0.16, 0.12, 0.085],
          [0, 1.04, 0.153, 0.15, 0.068, 0.025],
        );
      e("trim", trim);
      g.skirt = silhouette(
        [
          [0, 0.49],
          [0.32, 0.49],
          [0.32, 0.52],
          [0.24, 0.9],
          [0.2, 0.94],
          [0, 0.94],
        ],
        0.72,
      );
      e("badge", [[-0.125, 1.31, 0.175, 0.037, 0.047, 0.014]]);
      e("farSkin", [
        [0, 1.77, 0, 0.18, 0.235, 0.174],
        [-0.32, 1.03, 0, 0.07, 0.28, 0.07],
        [0.32, 1.03, 0, 0.07, 0.28, 0.07],
      ]);
      e("farHair", [[0, 1.94, -0.025, 0.19, 0.105, 0.17]]);
      e("farBottom", [
        [-0.115, 0.48, 0, 0.1, 0.43, 0.1],
        [0.115, 0.48, 0, 0.1, 0.43, 0.1],
        [0, 0.87, 0, 0.22, 0.1, 0.14],
      ]);
      e("farShoes", [
        [-0.115, 0.066, 0.048, 0.095, 0.066, 0.17],
        [0.115, 0.066, 0.048, 0.095, 0.066, 0.17],
      ]);
      e("beret", [[0, 0.205, -0.02, 0.215, 0.075, 0.19]]);
      const materials = {
        skin: new THREE.MeshStandardMaterial({
          color: a.skinTone,
          roughness: 0.78,
        }),
        hair: new THREE.MeshStandardMaterial({
          color: a.hairColor,
          roughness: 1,
        }),
        top: new THREE.MeshStandardMaterial({
          color: a.topColor,
          roughness: 0.92,
        }),
        bottom: new THREE.MeshStandardMaterial({
          color: a.bottomColor,
          roughness: 0.96,
        }),
        shoe: new THREE.MeshStandardMaterial({
          color: a.shoeColor,
          roughness: 0.8,
        }),
        white: new THREE.MeshStandardMaterial({
          color: "#f3ede2",
          roughness: 0.85,
        }),
        dark: new THREE.MeshStandardMaterial({
          color: "#251b1c",
          roughness: 0.9,
        }),
        trim: new THREE.MeshStandardMaterial({
          color: new THREE.Color(a.topColor).multiplyScalar(0.76),
          roughness: 0.9,
        }),
      };
      return { g, materials };
    }, [
      a.skinTone,
      a.hairColor,
      a.topColor,
      a.bottomColor,
      a.shoeColor,
      a.hairstyle,
      a.topStyle,
      seed,
      width,
    ]);
    useEffect(
      () => () => {
        Object.values(resources.g).forEach((g) => g.dispose());
        Object.values(resources.materials).forEach((m) => m.dispose());
      },
      [resources],
    );
    useFrame(({ clock, camera }, dt) => {
      if (!root.current) return;
      const s = motion.current,
        delta = Math.min(dt, 0.05),
        t = clock.elapsedTime + (seed % 100);
      root.current.getWorldPosition(s.world);
      const distant =
        s.world.distanceToSquared(camera.position) > 24 * 24 &&
        animation !== "sit" &&
        animation !== "sleep";
      if (near.current) near.current.visible = !distant;
      if (far.current) far.current.visible = distant;
      const distance = s.initialized
        ? Math.hypot(s.world.x - s.previous.x, s.world.z - s.previous.z)
        : 0;
      s.previous.copy(s.world);
      s.initialized = true;
      const seated = animation === "sit",
        sleep = animation === "sleep";
      const requested = animation === "walk" || animation === "run";
      const speed = trackMovement
        ? distance < 1 && dt > 0
          ? distance / dt
          : 0
        : requested
          ? animation === "run"
            ? 9.5
            : 6
          : 0;
      const moving = !seated && !sleep && speed > 0.035;
      s.blend = THREE.MathUtils.damp(s.blend, moving ? 1 : 0, 12, delta);
      s.phase += moving ? Math.min(speed, 12) * delta * 4.2 : 0;
      const swing = Math.sin(s.phase) * 0.62 * s.blend;
      // Right hand (i = 0) carries a purchase: forearm raised in front, item kept level.
      const holding = !!held && !sleep && Date.now() < held.until;
      if (heldRef.current) heldRef.current.visible = holding;
      for (let i = 0; i < 2; i++) {
        const carry = holding && i === 0;
        const sign = i === 0 ? 1 : -1,
          leg = legs.current[i],
          knee = knees.current[i],
          arm = arms.current[i],
          elbow = elbows.current[i];
        if (leg) {
          leg.rotation.x = THREE.MathUtils.damp(
            leg.rotation.x,
            seated ? -Math.PI / 2 : sign * swing,
            16,
            delta,
          );
        }
        if (knee)
          knee.rotation.x = THREE.MathUtils.damp(
            knee.rotation.x,
            seated
              ? Math.PI / 2
              : Math.max(0, -Math.sin(s.phase + (i ? Math.PI : 0))) *
                  0.48 *
                  s.blend,
            16,
            delta,
          );
        if (leg && knee) {
          // Plant the stance sole at y=0; only the returning foot lifts.
          const lift =
            Math.max(0, -Math.sin(s.phase + (i ? Math.PI : 0))) *
            0.12 *
            s.blend;
          if (ankles.current[i])
            ankles.current[i]!.rotation.x = -leg.rotation.x - knee.rotation.x;
          leg.position.y = seated
            ? 0.91
            : 0.41 * Math.cos(leg.rotation.x) +
              0.5 * Math.cos(leg.rotation.x + knee.rotation.x) +
              lift;
        }
        if (arm) {
          arm.rotation.x = THREE.MathUtils.damp(
            arm.rotation.x,
            carry ? -0.45 : seated ? -0.35 : -sign * swing * 0.72,
            12,
            delta,
          );
          arm.rotation.z = THREE.MathUtils.damp(
            arm.rotation.z,
            i === 1 && animation === "wave"
              ? -2.4 + Math.sin(t * 5) * 0.15
              : animation === "cheer"
                ? sign * 2.4
                : sign * 0.07,
            12,
            delta,
          );
        }
        if (elbow)
          elbow.rotation.x = carry
            ? THREE.MathUtils.damp(elbow.rotation.x, -1.15, 12, delta)
            : -0.12 - s.blend * 0.18;
        if (carry && heldRef.current && arm && elbow)
          heldRef.current.rotation.x = -(arm.rotation.x + elbow.rotation.x);
      }
      if (skirt.current)
        skirt.current.rotation.x = THREE.MathUtils.damp(
          skirt.current.rotation.x,
          seated ? -Math.PI / 2 : 0,
          12,
          delta,
        );
      if (chest.current) {
        chest.current.scale.y = 1 + Math.sin(t * 1.7) * 0.003 * (1 - s.blend);
        chest.current.rotation.y = swing * 0.065;
      }
      if (head.current)
        head.current.rotation.y = Math.sin(t * 0.65) * 0.04 * (1 - s.blend);
      root.current.position.y = THREE.MathUtils.damp(
        root.current.position.y,
        seated ? -0.39 : 0,
        14,
        delta,
      );
      root.current.rotation.x = THREE.MathUtils.damp(
        root.current.rotation.x,
        sleep ? -Math.PI / 2 : 0,
        12,
        delta,
      );
      root.current.scale.setScalar(sleep ? 0.9 : 1);
    });
    const m = resources.materials;
    const part = (geometry: string, material: keyof typeof m) => (
      <mesh
        geometry={resources.g[geometry]}
        material={m[material]}
        castShadow
      />
    );
    return (
      <group ref={root} dispose={null}>
        <group ref={far} visible={false}>
          {part("torso", "top")}
          {part("farSkin", "skin")}
          {part("farHair", "hair")}
          {part("farBottom", "bottom")}
          {part("farShoes", "shoe")}
          {a.bottomStyle === "skirt" && part("skirt", "bottom")}
        </group>
        <group ref={near}>
          {part("hips", "bottom")}
          <group ref={chest}>
            {part("torso", "top")}
            {part("neck", "skin")}
            {part("trim", "trim")}
            {accessory === "security" && part("badge", "white")}
            <group ref={head} position={[0, 1.77, 0]}>
              {part("head", "skin")}
              {part("white", "white")}
              {part("features", "dark")}
              {part("hair", "hair")}
              {accessory === "security" && part("beret", "bottom")}
            </group>
          </group>
          {a.bottomStyle === "skirt" && (
            <group ref={skirt} position={[0, 0.91, 0]}>
              <group position={[0, -0.91, 0]}>{part("skirt", "bottom")}</group>
            </group>
          )}
          {[-1, 1].map((side, i) => (
            <group key={side}>
              <group
                ref={(el) => {
                  arms.current[i] = el;
                }}
                position={[side * (width + 0.032), 1.43, 0]}
              >
                {part(
                  "upperArm",
                  ["shirt", "hoodie"].includes(a.topStyle) ? "top" : "skin",
                )}
                {part("sleeve", "top")}
                <group
                  ref={(el) => {
                    elbows.current[i] = el;
                  }}
                  position={[0, -0.285, 0]}
                >
                  {part(
                    "forearm",
                    ["hoodie", "shirt"].includes(a.topStyle) ? "top" : "skin",
                  )}
                  {part("hand", "skin")}
                  {i === 0 && held && (
                    <group ref={heldRef} position={[0, -0.31, 0.02]} scale={1.3} visible={false}>
                      <HeldProp kind={held.kind} />
                    </group>
                  )}
                </group>
              </group>
              <group
                ref={(el) => {
                  legs.current[i] = el;
                }}
                position={[side * 0.115, 0.91, 0]}
              >
                {part(
                  "upperLeg",
                  a.bottomStyle === "skirt" ? "skin" : "bottom",
                )}
                <group
                  ref={(el) => {
                    knees.current[i] = el;
                  }}
                  position={[0, -0.41, 0]}
                >
                  {part(
                    "lowerLeg",
                    a.bottomStyle === "skirt" ? "skin" : "bottom",
                  )}
                  <group
                    ref={(el) => {
                      ankles.current[i] = el;
                    }}
                    position={[0, -0.5, 0]}
                  >
                    {part("shoe", "shoe")}
                    {a.shoeStyle === "sneakers" && part("sole", "white")}
                  </group>
                </group>
              </group>
            </group>
          ))}
        </group>
      </group>
    );
  },
);
