import React, { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as T from "three";
import { createHostelAsset } from "./hostelAssets";
import { useDayNight } from "./dayNight";
export function HostelItemModel({
  id,
  ghost = false,
  valid = true,
  active = false,
}: {
  id: string;
  ghost?: boolean;
  valid?: boolean;
  active?: boolean;
}) {
  const [model, setModel] = useState<T.Group | null>(null),
    root = useRef<T.Group>(null);
  useEffect(() => {
    let stopped = false;
    const owned: T.Material[] = [];
    setModel(null);
    createHostelAsset(id)
      .then((g) => {
        g.traverse((o) => {
          if (o instanceof T.Mesh) {
            const materials = (
              Array.isArray(o.material) ? o.material : [o.material]
            ).map((m: T.MeshStandardMaterial) => {
              const copy = m.clone();
              owned.push(copy);
              if (ghost) {
                copy.color.set(valid ? "#3dac70" : "#d64c45");
                copy.transparent = true;
                copy.opacity = 0.5;
                copy.depthWrite = false;
              }
              return copy;
            });
            o.material = Array.isArray(o.material) ? materials : materials[0];
          }
        });
        if (!stopped) setModel(g);
        else owned.forEach((m) => m.dispose());
      })
      .catch(() => {
        if (!stopped) {
          const fallback = new T.Group();
          fallback.add(
            new T.Mesh(
              new T.BoxGeometry(0.5, 0.5, 0.5),
              new T.MeshBasicMaterial({ color: "#cc4444", wireframe: true }),
            ),
          );
          setModel(fallback);
        }
      });
    return () => {
      stopped = true;
      owned.forEach((m) => m.dispose());
    };
  }, [id, ghost, valid]);
  useFrame(({ clock }, dt) => {
    if (!model) return;
    const fan = model.getObjectByName("fanBlades");
    if (fan && active) fan.rotation.z += dt * 18;
    const screen = model.getObjectByName("tvScreen") as T.Mesh | undefined;
    if (screen) {
      const m = screen.material as T.MeshStandardMaterial;
      m.color.set(active ? "#6db9a2" : "#12201d");
      m.emissive.set(active ? "#286c57" : "#000000");
      m.emissiveIntensity = active
        ? 0.6 + Math.sin(clock.elapsedTime * 2) * 0.2
        : 0;
    }
    // Room makeover appliances (migration 024).
    const drum = model.getObjectByName("drum");
    if (drum && active) drum.rotation.z += dt * 9;
    model.traverse((o) => {
      if (o.name === "flame") {
        o.visible = active;
        if (active) o.scale.y = 0.05 * (1 + Math.sin(clock.elapsedTime * 22 + o.position.x * 9) * 0.25);
      }
    });
    const led = model.getObjectByName("ledStrip") as T.Mesh | undefined;
    if (led) {
      const m = led.material as T.MeshStandardMaterial;
      if (active) {
        m.color.setHSL((clock.elapsedTime * 0.08) % 1, 0.9, 0.6);
        m.emissive.copy(m.color);
        m.emissiveIntensity = 1.4;
      } else {
        m.color.set("#5b5b78");
        m.emissiveIntensity = 0;
      }
    }
    const fridge = model.getObjectByName("fridgeLight") as T.Mesh | undefined;
    if (fridge) (fridge.material as T.MeshStandardMaterial).color.set(active ? "#4ade80" : "#3a3a3a");
    // The rechargeable lamp glows after dark.
    const bulb = model.getObjectByName("lampBulb") as T.Mesh | undefined;
    if (bulb) {
      const m = bulb.material as T.MeshStandardMaterial;
      m.emissive.set("#ffd27a");
      m.emissiveIntensity = useDayNight.getState().night * 1.5;
    }
    const indicator = model.getObjectByName("indicator") as T.Mesh | undefined;
    if (indicator)
      (indicator.material as T.MeshStandardMaterial).color.set(
        active ? "#7bd38a" : "#7f2828",
      );
    if (root.current)
      root.current.position.x =
        indicator && active ? Math.sin(clock.elapsedTime * 40) * 0.004 : 0;
  });
  return (
    <group ref={root}>
      {model && <primitive object={model} dispose={null} />}
    </group>
  );
}
