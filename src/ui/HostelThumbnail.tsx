import React, { useEffect, useState } from "react";
import { hostelThumbnail } from "../game/world/hostelAssets";
export function HostelThumbnail({ id, name }: { id: string; name: string }) {
  const [src, setSrc] = useState(""),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setSrc("");
    setFailed(false);
    hostelThumbnail(id).then(
      (s) => {
        if (live) setSrc(s);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [id]);
  return (
    <div className="hostel-thumbnail">
      {src ? (
        <img src={src} alt={name} width="240" height="180" />
      ) : (
        <span>{failed ? "Preview unavailable" : "Preparing preview…"}</span>
      )}
    </div>
  );
}
