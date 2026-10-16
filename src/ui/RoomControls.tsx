import React from "react";
import { roomSizeNow, useHostelStore } from "../stores/hostelStore";
import { useAuthStore } from "../stores/authStore";
import { useGameStore } from "../stores/gameStore";
import { hostelItem } from "../config/hostelItems";
import { candidate, placementError, position } from "../config/roomPlacement";
export function RoomControls() {
  const s = useHostelStore(),
    user = useAuthStore((x) => x.user),
    here = useGameStore((x) => x.myPosition),
    modal = useGameStore((x) => x.activeModal);
  if (!s.owner) return null;
  const mine = s.owner === user?.id,
    nearBed = Math.hypot(here[0] + 2.6, here[2] + 2.8) < 2.5;
  const id = s.selected || (nearBed ? "hostel_mattress" : null),
    item = id ? hostelItem(id) : null;
  const p = s.snapshot?.placements.find((p) => p.item_id === id),
    bed = id === "hostel_mattress";
  const near = bed
    ? nearBed
    : p
      ? Math.hypot(here[0] - position(p)[0], here[2] - position(p)[2]) < 2.5
      : false;
  if (s.pose)
    return (
      <>
        <div className="room-rest-bar" role="status">
          {s.pose.animation === "sleep" ? "Sleeping…" : "Sitting"}
          <button onClick={s.wake}>
            {s.pose.animation === "sleep" ? "Wake Up" : "Stand"}
          </button>
          {s.error && <p role="alert">{s.error}</p>}
        </div>
        {s.pose.animation === "sleep" && (
          <div className="room-sleep-fade" aria-hidden="true" />
        )}
      </>
    );
  if (s.preview) {
    const preview = s.preview,
      error = placementError(preview, s.snapshot?.placements || [], roomSizeNow());
    return (
      <section className="room-edit-bar" aria-label="Room edit mode">
        <strong>{item?.name || hostelItem(preview.item)?.name}</strong>
        <p>
          {error || "Tap or drag the floor to position. Green means ready."}
        </p>
        <div className="hostel-actions">
          <button
            disabled={
              s.busy ||
              ["wall", "bed"].includes(
                hostelItem(preview.item)?.placementType || "",
              )
            }
            onClick={() =>
              useHostelStore.setState({
                preview: candidate(
                  preview.item,
                  preview.x,
                  preview.z,
                  (preview.rotation + 45) % 360,
                  s.snapshot?.placements || [],
                  roomSizeNow(),
                ),
              })
            }
          >
            Rotate {preview.rotation}°
          </button>
          <button disabled={s.busy || !!error} onClick={s.confirmEdit}>
            {s.busy ? "Saving…" : "Place"}
          </button>
          <button
            disabled={s.busy}
            onClick={() =>
              useHostelStore.setState({ preview: null, error: null })
            }
          >
            Cancel
          </button>
        </div>
        {s.error && <p role="alert">{s.error}</p>}
      </section>
    );
  }
  if (modal || !id) return null;
  // Walking up to the bed just shows a small round Sleep icon; tapping furniture opens the full bar.
  if (bed && !s.selected)
    return near ? (
      <button className="room-quick" aria-label="Sleep" title="Sleep" onClick={() => s.rest(id)}>🛏️</button>
    ) : null;
  return (
    <section className="room-item-bar" aria-label="Furniture actions">
      <strong>{bed ? "Starter mattress" : item?.name}</strong>
      <div className="hostel-actions">
        {near && (bed || id === "hostel_chair" || id === "hostel_bean_bag") && (
          <button onClick={() => s.rest(id)}>{bed ? "Sleep" : "Sit"}</button>
        )}
        {!near && (bed || item?.interactions.length !== 0) && (
          <span>Walk closer to interact</span>
        )}
        {mine && p && (
          <>
            <button onClick={() => s.beginEdit(id)}>Move</button>
            <button
              disabled={
                s.busy ||
                item?.placementType === "wall" ||
                item?.placementType === "bed"
              }
              onClick={() => {
                const [x, , z] = position(p),
                  next = candidate(id, x, z, (p.rotation + 45) % 360, s.snapshot?.placements || [], roomSizeNow()),
                  error = placementError(next, s.snapshot?.placements || [], roomSizeNow());
                if (error) useHostelStore.setState({ error });
                else void s.command("place", { ...next, owner: s.owner });
              }}
            >
              Rotate
            </button>
            <button
              disabled={s.busy}
              onClick={async () => {
                if (
                  await s.command("place", {
                    item: id,
                    anchor: null,
                    owner: s.owner,
                  })
                )
                  useHostelStore.setState({ selected: null });
              }}
            >
              Remove
            </button>
          </>
        )}
        {mine && near && item?.interactions.includes("toggle") && (
          <button
            disabled={s.busy}
            onClick={() =>
              s.command(id === "hostel_tv_basic" ? "tv" : "toggle", {
                item: id,
                owner: s.owner,
              })
            }
          >
            {(id === "hostel_tv_basic" ? s.snapshot?.room.tv_on : p?.active)
              ? id === "hostel_generator_small"
                ? "Stop Gen"
                : "Turn Off"
              : id === "hostel_generator_small"
                ? "Start Gen"
                : "Turn On"}
          </button>
        )}
        {near && id === "hostel_ps_console" && (
          <button
            onClick={() => {
              if (
                s.snapshot?.placements.some(
                  (p) => p.item_id === "hostel_tv_basic",
                )
              )
                useGameStore.setState({ activeModal: "ps_match" });
              else useHostelStore.setState({ notice: "Connect a TV first." });
            }}
          >
            Play PS
          </button>
        )}
        {s.selected && (
          <button
            aria-label="Close furniture actions"
            onClick={() =>
              useHostelStore.setState({ selected: null, error: null })
            }
          >
            ×
          </button>
        )}
      </div>
      {s.error && <p role="alert">{s.error}</p>}
    </section>
  );
}
