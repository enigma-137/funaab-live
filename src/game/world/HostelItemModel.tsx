import React, { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as T from "three";
import { createHostelAsset } from "./hostelAssets";
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
