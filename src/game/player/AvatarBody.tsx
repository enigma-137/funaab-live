import React, { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AvatarConfig } from "../../types/game";
import { normalizeAvatar } from "../../config/avatar";
import type { HeldItem } from "../../config/heldItems";
import { HeldProp } from "./HeldProp";
import { identitySeed } from "./avatarGeometry";
import {
  buildAvatarGeometry,
  HEAD_SCALE,
  HEAD_Y,
  lipColor,
} from "./avatarParts";

export const AvatarBody = memo(
  ({
    config,
    animation = "idle",
    identity = "",
    trackMovement = false,
    accessory,
    held,
    table,
  }: {
    config: AvatarConfig;
    animation?: string;
    identity?: string;
    trackMovement?: boolean;
    accessory?: "security";
    /** Food or drink just bought, carried in the right hand until it expires. */
    held?: HeldItem | null;
    /** Seated at a restaurant table: serve `held` on the table (height, distance in front). */
    table?: { y: number; z: number } | null;
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
    const skirt = useRef<THREE.Group>(null),
      skirtLow = useRef<THREE.Group>(null);
    const ankles = useRef<(THREE.Group | null)[]>([]);
    const heldRef = useRef<THREE.Group>(null),
      servedRef = useRef<THREE.Group>(null);
    const arms = useRef<(THREE.Group | null)[]>([]),
      elbows = useRef<(THREE.Group | null)[]>([]);
    const motion = useRef({
      previous: new THREE.Vector3(),
      world: new THREE.Vector3(),
      initialized: false,
      phase: seed % 100,
      blend: 0,
    });
    const resources = useMemo(() => {
      const { g, look, width } = buildAvatarGeometry(a, seed);
      const materials = {
        skin: new THREE.MeshStandardMaterial({
          color: a.skinTone,
          roughness: 0.7,
        }),
        lips: new THREE.MeshStandardMaterial({
          color: lipColor(a),
          roughness: 0.55,
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
          roughness: 0.75,
        }),
        white: new THREE.MeshStandardMaterial({
          color: "#f3ede2",
          roughness: 0.85,
        }),
        dark: new THREE.MeshStandardMaterial({
          color: "#1d1514",
          roughness: 0.9,
        }),
        trim: new THREE.MeshStandardMaterial({
          color: new THREE.Color(a.topColor).multiplyScalar(0.76),
          roughness: 0.9,
        }),
        gold: new THREE.MeshStandardMaterial({
          color: "#d4a017",
          roughness: 0.35,
          metalness: 0.6,
        }),
      };
      return { g, look, width, materials };
      // Rebuild only when the appearance changes, not when a caller passes a fresh object.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(a), seed]);
    const { look, width } = resources;
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
      const has = !!held && !sleep && Date.now() < held.until;
      const served = has && seated && !!table;
      const holding = has && !served;
      if (heldRef.current) heldRef.current.visible = holding;
      if (servedRef.current) servedRef.current.visible = served;
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
      if (skirt.current) {
        skirt.current.rotation.x = THREE.MathUtils.damp(
          skirt.current.rotation.x,
          seated ? -Math.PI / 2 : 0,
          12,
          delta,
        );
        // Folded over the lap the hem gathers in instead of flaring like a barrel.
        const gather = THREE.MathUtils.damp(skirt.current.scale.x, seated ? 0.72 : 1, 12, delta);
        skirt.current.scale.set(gather, 1, gather);
      }
      // A long skirt's hem drops in front of the shins, which hang from the knees at z 0.41.
      if (skirtLow.current) {
        const p = skirtLow.current.position;
        p.y = THREE.MathUtils.damp(p.y, seated ? 0.41 : 0, 12, delta);
        p.z = THREE.MathUtils.damp(p.z, seated ? 0.41 : 0, 12, delta);
      }
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
    const part = (geometry: string, material: keyof typeof m) =>
      resources.g[geometry] ? (
        <mesh
          geometry={resources.g[geometry]}
          material={m[material]}
          castShadow
        />
      ) : null;
    const legMaterial = look.legMaterial;
    const armMaterial = look.longSleeves ? "top" : "skin";
    return (
      <>
      {held && table && (
        <group ref={servedRef} position={[0, table.y, table.z]} visible={false}>
          <HeldProp kind={held.kind} served />
        </group>
      )}
      <group ref={root} dispose={null}>
        <group ref={far} visible={false}>
          {part("torso", "top")}
          {part("farSkin", "skin")}
          {part("farHair", look.hairMaterial)}
          {part("farLegs", look.legMaterial)}
          {part("farHips", look.hipsMaterial)}
          {part("farShoes", "shoe")}
          {part("skirt", "bottom")}
          {part("skirtLow", "bottom")}
          {part("tunic", "top")}
        </group>
        <group ref={near}>
          {part("hips", look.hipsMaterial)}
          <group ref={chest}>
            {part("torso", "top")}
            {part("bust", "top")}
            {part("flare", "top")}
            {part("neck", "skin")}
            {part("trim", "trim")}
            {part("inner", "white")}
            {part("embroidery", "gold")}
            {accessory === "security" && part("badge", "white")}
            <group ref={head} position={[0, HEAD_Y, 0]} scale={HEAD_SCALE}>
              {part("head", "skin")}
              {part("white", "white")}
              {part("features", "dark")}
              {part("lips", "lips")}
              {part("earrings", "gold")}
              {part("hair", look.hairMaterial)}
              {accessory === "security" && part("beret", "bottom")}
            </group>
          </group>
          {(look.skirt || look.tunic) && (
            <group ref={skirt} position={[0, 0.91, 0]}>
              <group position={[0, -0.91, 0]}>
                {part("skirt", "bottom")}
                {part("tunic", "top")}
              </group>
            </group>
          )}
          {look.longSkirt && (
            <group ref={skirtLow}>{part("skirtLow", "bottom")}</group>
          )}
          {[-1, 1].map((side, i) => (
            <group key={side}>
              <group
                ref={(el) => {
                  arms.current[i] = el;
                }}
                position={[side * (width + 0.032), 1.43, 0]}
              >
                {part("upperArm", armMaterial)}
                {part("sleeve", "top")}
                <group
                  ref={(el) => {
                    elbows.current[i] = el;
                  }}
                  position={[0, -0.285, 0]}
                >
                  {part("forearm", armMaterial)}
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
                {part("upperLeg", legMaterial)}
                {part("shortLeg", "bottom")}
                <group
                  ref={(el) => {
                    knees.current[i] = el;
                  }}
                  position={[0, -0.41, 0]}
                >
                  {part("lowerLeg", legMaterial)}
                  <group
                    ref={(el) => {
                      ankles.current[i] = el;
                    }}
                    position={[0, -0.5, 0]}
                  >
                    {part("shoe", "shoe")}
                    {part("sole", "white")}
                    {part("foot", "skin")}
                  </group>
                </group>
              </group>
            </group>
          ))}
        </group>
      </group>
      </>
    );
  },
);
